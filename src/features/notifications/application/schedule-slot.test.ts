import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createJobs } from "@/composition/jobs";
import { createUnitOfWork } from "@/composition/unit-of-work";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { AccessEventKind } from "@/features/access/domain/access-event";
import type { Account } from "@/features/access/domain/account";
import type { NotificationJob } from "@/features/notifications/application/notification-job";
import { parseTimeOfDay } from "@/features/notifications/domain/time-of-day";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { origin, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import {
  browserSubscription,
  recordingPushSender,
  testJobs,
} from "@/testing/support/notifications";

// Thursday 29 October 2026 at 07:30 in Vietnam, and Friday at 17:00
const thursdayMorning = "2026-10-29T00:30:00Z";
const fridayEvening = "2026-10-30T10:00:00Z";

async function lanWithAPhone(time: ReturnType<typeof testClock>) {
  const lan = await seedAccount(time.clock, "lan", "Lan");
  const phone = await seedSession(time.clock, lan);
  await testApp(time.clock).subscribeDevice(phone.session, browserSubscription(), origin());

  return { lan, phone };
}

async function recordEvent(kind: AccessEventKind, account: Account, at: string) {
  const work = createUnitOfWork(createDatabase(env.DB));
  work.accessEvents.add(
    AccessEvents.record(
      kind,
      { accountId: account.id, actorId: account.id },
      origin(),
      Temporal.Instant.from(at),
    ),
  );
  await work.commit();
}

function scheduledAt(iso: string) {
  return Temporal.Instant.from(iso);
}

describe("scheduleSlot, digests", () => {
  it("given a phone on and the default times, when 07:30 comes, then her morning list is queued, for that day", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    time.setTo(thursdayMorning);
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    const plan = await jobs.scheduleSlot(scheduledAt(thursdayMorning));

    expect(plan).toMatchObject({ digests: 1 });
    expect(jobs.queued).toContainEqual({
      kind: "digest",
      digest: "morning",
      accountId: lan.id,
      day: "2026-10-29",
    });
  });

  it("given the same phone, when 07:15 comes, then nothing is queued", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    await lanWithAPhone(time);
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    await jobs.scheduleSlot(scheduledAt("2026-10-29T00:15:00Z"));

    expect(jobs.queued.filter((job) => job.kind === "digest")).toEqual([]);
  });

  it("given the default times, when Friday 17:00 comes, then the summary is queued", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    time.setTo(fridayEvening);
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    await jobs.scheduleSlot(scheduledAt(fridayEvening));

    expect(jobs.queued).toContainEqual({
      kind: "digest",
      digest: "weekly",
      accountId: lan.id,
      day: "2026-10-30",
    });
  });

  it("given the morning list turned off, when its time comes, then nothing is queued", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { phone } = await lanWithAPhone(time);
    const weeklyAt = parseTimeOfDay("17:00");
    if (!weeklyAt.ok) {
      throw new Error(weeklyAt.error);
    }
    await testApp(time.clock).changeNotificationTimes(phone.session, {
      times: { morningAt: undefined, weeklyAt: weeklyAt.value },
      shown: undefined,
    });
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    await jobs.scheduleSlot(scheduledAt(thursdayMorning));

    expect(jobs.queued.filter((job) => job.kind === "digest")).toEqual([]);
  });

  it("given someone with no device on, or a device whose sign-in ran out, when 07:30 comes, then their morning list is queued all the same, for the list in the app", async () => {
    const time = testClock("2026-10-01T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    const minh = await seedAccount(time.clock, "minh", "Minh");
    await seedSession(time.clock, minh);
    time.setTo(thursdayMorning);
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    await jobs.scheduleSlot(scheduledAt(thursdayMorning));

    expect(
      jobs.queued.flatMap((job) => (job.kind === "digest" ? [job.accountId] : [])).toSorted(),
    ).toEqual([lan.id, minh.id].toSorted());
  });
});

describe("scheduleSlot, security notices", () => {
  it("given the first run, when it reads the access log, then it starts at the newest event and tells nobody about the past", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    await recordEvent("password_changed", lan, "2026-10-28T01:05:00Z");
    time.setTo("2026-10-28T02:00:00Z");
    const jobs = testJobs(time.clock, recordingPushSender().sender);

    expect(await jobs.scheduleSlot(scheduledAt("2026-10-28T02:00:00Z"))).toMatchObject({
      notices: 0,
    });
  });

  it("given a change to her sign-in after that, when the next runs come, then she is told once, and not before the event is a minute old", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    const jobs = testJobs(time.clock, recordingPushSender().sender);
    await jobs.scheduleSlot(scheduledAt("2026-10-28T01:00:00Z"));
    await recordEvent("passkey_added", lan, "2026-10-28T01:14:30Z");

    const tooSoon = await jobs.scheduleSlot(scheduledAt("2026-10-28T01:15:00Z"));
    const next = await jobs.scheduleSlot(scheduledAt("2026-10-28T01:30:00Z"));
    const after = await jobs.scheduleSlot(scheduledAt("2026-10-28T01:45:00Z"));

    expect([tooSoon.notices, next.notices, after.notices]).toEqual([0, 1, 0]);
    expect(jobs.queued).toContainEqual(
      expect.objectContaining({ kind: "notice", accountId: lan.id }),
    );
  });

  it("given the queue refusing, when a run fails, then the notice is not lost: the next run queues it", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const { lan } = await lanWithAPhone(time);
    const queued: NotificationJob[] = [];
    let down = false;
    const jobs = createJobs(
      {
        db: env.DB,
        jobs: {
          async send(batch) {
            if (down) {
              throw new Error("queue down");
            }
            queued.push(...batch);
          },
        },
        pushSender: undefined,
      },
      time.clock,
    );
    await jobs.scheduleSlot(scheduledAt("2026-10-28T01:00:00Z"));
    await recordEvent("passkey_added", lan, "2026-10-28T01:10:00Z");

    down = true;
    await expect(jobs.scheduleSlot(scheduledAt("2026-10-28T01:15:00Z"))).rejects.toThrow(
      /queue down/,
    );
    down = false;
    await jobs.scheduleSlot(scheduledAt("2026-10-28T01:30:00Z"));

    expect(queued).toContainEqual(expect.objectContaining({ kind: "notice", accountId: lan.id }));
  });
});
