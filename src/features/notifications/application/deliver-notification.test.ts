import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createUnitOfWork } from "@/composition/unit-of-work";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { Account } from "@/features/access/domain/account";
import type { NotificationJob } from "@/features/notifications/application/notification-job";
import type { PushOutcome } from "@/features/notifications/application/push-sender";
import { quietAfterDaysSchema } from "@/features/notifications/domain/notification-preference";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { content, testApp, testClock } from "@/testing/support/app";
import {
  browserSubscription,
  recordingPushSender,
  testJobs,
} from "@/testing/support/notifications";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

const thursday = "2026-10-29";

function morningOf(account: Account, day = thursday): NotificationJob {
  return { kind: "digest", digest: "morning", accountId: account.id, day };
}

async function lastOrderOn(time: ReturnType<typeof testClock>, name: string, day: string) {
  const app = testApp(time.clock);
  await anOrder(app, await aCustomer(app, name), [line("Găng tay", 1, 100_000)], day);
}

async function lanWithAPhone(time: ReturnType<typeof testClock>) {
  const lan = await seedAccount(time.clock, "lan", "Lan");
  const phone = await seedSession(time.clock, lan);
  await testApp(time.clock).subscribeDevice(phone.session, browserSubscription(), origin());

  return lan;
}

async function remind(
  time: ReturnType<typeof testClock>,
  by: Account,
  text: string,
  dueOn: string,
) {
  await testApp(time.clock).addReminder({
    by: by.id,
    details: { text: content(text), dueOn: Temporal.PlainDate.from(dueOn), customerId: undefined },
    fromNote: undefined,
  });
}

// The push channel's rows; the list in the app has tests of its own
async function ledger() {
  return rows<{ subject: string; status: string; attempts: number }>(
    "select subject, status, attempts from notification_delivery where channel = 'push'",
  );
}

async function inbox() {
  return rows<{ subject: string; title: string; path: string }>(
    "select subject, title, path from inbox_item order by created_at",
  );
}

describe("deliverNotification", () => {
  it("given reminders due and one late, when the morning job runs, then her phone gets the list once, however often the job comes back", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await remind(time, lan, "gọi lại nha khoa Minh Châu", "2026-10-27");
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);
    const push = recordingPushSender();
    const jobs = testJobs(time.clock, push.sender);

    expect(await jobs.deliver(morningOf(lan))).toEqual({ kind: "done" });
    expect(await jobs.deliver(morningOf(lan))).toEqual({ kind: "done" });

    expect(push.sent.map((sent) => sent.message.title)).toEqual(["Hôm nay có 2 việc"]);
    expect(push.sent[0]?.message.body).toContain("quá hạn 2 ngày");
    expect(await ledger()).toEqual([{ subject: "morning", status: "sent", attempts: 1 }]);
  });

  it("given nothing due and nobody gone quiet, when the morning job runs, then nothing is sent", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));

    expect(push.sent).toEqual([]);
    expect(await ledger()).toEqual([{ subject: "morning", status: "skipped", attempts: 1 }]);
  });

  it("given a customer whose last order is three weeks old today, when the morning job runs, then they are named, and not the morning after", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await lastOrderOn(time, "Nha khoa Lan Anh", "2026-10-08");
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));
    time.setTo("2026-10-30T00:30:00Z");
    await testJobs(time.clock, push.sender).deliver(morningOf(lan, "2026-10-30"));

    expect(push.sent.map(({ message }) => [message.title, message.body])).toEqual([
      ["1 khách lâu không đặt", "Nha khoa Lan Anh"],
    ]);
  });

  it("given she counts 30 days, when her morning job runs, then the customer reaching 30 is named and the one at 21 is not", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    const { session } = await seedSession(time.clock, lan);
    await lastOrderOn(time, "Nha khoa Lan Anh", "2026-10-08");
    await lastOrderOn(time, "Hướng Dương", "2026-09-29");
    expectOk(
      await testApp(time.clock).changeNotificationQuietDays(session, {
        days: quietAfterDaysSchema.parse(30),
        shown: undefined,
      }),
    );
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));

    expect(push.sent.map(({ message }) => message.body)).toEqual(["Hướng Dương"]);
  });

  it("given the other person counts 30 days, when her morning job runs, then hers still counts 21", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    const minh = await seedAccount(time.clock, "minh", "Minh");
    await lastOrderOn(time, "Nha khoa Lan Anh", "2026-10-08");
    expectOk(
      await testApp(time.clock).changeNotificationQuietDays(
        (await seedSession(time.clock, minh)).session,
        { days: quietAfterDaysSchema.parse(30), shown: undefined },
      ),
    );
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));

    expect(push.sent.map(({ message }) => message.body)).toEqual(["Nha khoa Lan Anh"]);
  });

  it("given a push service that is busy, when the job runs, then it asks to be retried after the service's wait, and the retry sends", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);
    let answer: PushOutcome = { kind: "retry", afterSeconds: 120 };
    const push = recordingPushSender(() => answer);
    const jobs = testJobs(time.clock, push.sender);

    expect(await jobs.deliver(morningOf(lan))).toEqual({ kind: "retry", afterSeconds: 120 });
    answer = { kind: "sent" };
    expect(await jobs.deliver(morningOf(lan))).toEqual({ kind: "done" });

    expect(push.sent).toHaveLength(2);
    expect(await ledger()).toEqual([{ subject: "morning", status: "sent", attempts: 2 }]);
  });

  it("given a browser that dropped its subscription, when sent to, then the subscription is deleted", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);

    await testJobs(time.clock, recordingPushSender(() => ({ kind: "gone" })).sender).deliver(
      morningOf(lan),
    );

    expect(await rows("select id from push_subscription")).toHaveLength(0);
    expect(await ledger()).toEqual([{ subject: "morning", status: "skipped", attempts: 1 }]);
  });

  it("given the other person made a recovery link for her, when the notice job runs, then she is told who did it", async () => {
    const time = testClock("2026-10-29T02:12:00Z");
    const lan = await lanWithAPhone(time);
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const event = AccessEvents.record(
      "setup_link_issued",
      { accountId: lan.id, actorId: minh.id, detail: { purpose: "recovery" } },
      origin(),
      time.clock(),
    );
    const work = createUnitOfWork(createDatabase(env.DB));
    work.accessEvents.add(event);
    await work.commit();
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver({
      kind: "notice",
      accountId: lan.id,
      eventId: event.id,
    });

    expect(push.sent.map(({ message }) => message.title)).toEqual([
      "Vừa có link khôi phục cho tài khoản của bạn",
    ]);
    expect(push.sent[0]?.message.body.startsWith("Minh làm.")).toBe(true);
  });

  it("given her only device's sign-in ran out, when the job runs, then nothing is sent and the delivery is skipped", async () => {
    const time = testClock("2026-10-01T01:00:00Z");
    const lan = await lanWithAPhone(time);
    time.setTo("2026-10-29T00:30:00Z");
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));

    expect(push.sent).toEqual([]);
    expect(await ledger()).toEqual([{ subject: "morning", status: "skipped", attempts: 1 }]);
  });

  it("given no push keys configured, when a job runs, then nothing goes out by push and the list in the app still gets it", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);

    expect(await testJobs(time.clock, undefined).deliver(morningOf(lan))).toEqual({ kind: "done" });
    expect(await ledger()).toEqual([]);
    expect(await inbox()).toEqual([
      { subject: "morning", title: "Hôm nay có 1 việc", path: "/reminders" },
    ]);
  });

  it("given someone with no browser receiving, when the morning job runs, then the list in the app keeps it", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);
    const push = recordingPushSender();

    await testJobs(time.clock, push.sender).deliver(morningOf(lan));

    expect(push.sent).toEqual([]);
    expect(await inbox()).toEqual([
      { subject: "morning", title: "Hôm nay có 1 việc", path: "/reminders" },
    ]);
  });

  it("given a push service that is busy, when the job is retried, then the list in the app keeps it once", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);
    await remind(time, lan, "giao 2 hộp thuốc tê", thursday);
    const jobs = testJobs(
      time.clock,
      recordingPushSender(() => ({ kind: "retry", afterSeconds: 60 })).sender,
    );

    await jobs.deliver(morningOf(lan));
    await jobs.deliver(morningOf(lan));

    expect(await inbox()).toHaveLength(1);
  });

  it("given a morning with nothing to say, when the job runs, then the list gets nothing either", async () => {
    const time = testClock("2026-10-29T00:30:00Z");
    const lan = await lanWithAPhone(time);

    await testJobs(time.clock, recordingPushSender().sender).deliver(morningOf(lan));

    expect(await inbox()).toEqual([]);
  });
});
