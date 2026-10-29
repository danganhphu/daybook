import { Temporal } from "temporal-polyfill/implementation";

import type {
  AccessEventRepository,
  AccessLogPosition,
} from "@/features/access/domain/access-event-repository";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import { deliveryRetentionDays } from "@/features/notifications/domain/delivery";
import { isNotice } from "@/features/notifications/domain/notice";
import type { NoticeCursorRepository } from "@/features/notifications/domain/notice-cursor-repository";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import { digestKinds } from "@/features/notifications/domain/notification-preference";
import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import { slotAt, type Slot } from "@/features/notifications/domain/slot";
import { timesOfDay } from "@/features/notifications/domain/time-of-day";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { DeliveryLedger } from "./delivery-ledger";
import type { JobSender, NotificationJob } from "./notification-job";
import type { InboxWrites, NoticeCursorWrites } from "./notification-writes";

export type ScheduleSlotDeps = {
  readonly clock: Clock;
  readonly accounts: AccountRepository;
  readonly preferences: NotificationPreferenceRepository;
  readonly accessEvents: AccessEventRepository;
  readonly noticeCursor: NoticeCursorRepository;
  readonly ledger: DeliveryLedger;
  readonly jobs: JobSender;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly noticeCursor: NoticeCursorWrites;
    readonly inbox: InboxWrites;
  }>;
};

export type SlotPlan = {
  readonly slot: Slot;
  readonly digests: number;
  readonly notices: number;
};

// Read per run, at most; the rest wait for the next quarter hour
const noticesPerRun = 50;
// An event is relayed only once it is this old, so one still being committed by another request is not skipped
const noticeSettling = Temporal.Duration.from({ minutes: 1 });
const hoursPerDay = 24;

type Relay = {
  readonly jobs: ReadonlyArray<NotificationJob>;
  readonly movedTo: AccessLogPosition | undefined;
};

async function relayNotices(deps: ScheduleSlotDeps, upTo: Temporal.Instant): Promise<Relay> {
  const cursor = await deps.noticeCursor.get();
  if (cursor === undefined) {
    // The first run starts at the newest event: what happened before nobody can be told about now
    const latest = await deps.accessEvents.latest();
    return {
      jobs: [],
      movedTo: latest === undefined ? undefined : { occurredAt: latest.occurredAt, id: latest.id },
    };
  }

  const events = await deps.accessEvents.listAfter(cursor, upTo, noticesPerRun);
  const last = events.at(-1);

  return {
    jobs: events.filter(isNotice).map((event): NotificationJob => ({
      kind: "notice",
      accountId: event.accountId,
      eventId: event.id,
    })),
    movedTo: last === undefined ? undefined : { occurredAt: last.occurredAt, id: last.id },
  };
}

// The scheduler, every quarter hour: who is due a digest in this slot, and which security events are new. Everyone is,
// with a browser receiving push or not: the list in the app keeps every digest. It only queues; the queue's consumer
// sends, one person and one message at a time (Queue-Based Load Leveling).
export async function scheduleSlot(
  deps: ScheduleSlotDeps,
  scheduledTime: Temporal.Instant,
): Promise<SlotPlan> {
  const now = deps.clock();
  const slot = slotAt(scheduledTime);
  const accounts = (await deps.accounts.list()).map((account) => account.id);
  const stored = await deps.preferences.getMany(accounts);
  const digests = accounts.flatMap((accountId) => {
    const preference = stored.get(accountId) ?? NotificationPreferences.defaults(accountId);
    return digestKinds
      .filter((kind) => NotificationPreferences.isDue(preference, kind, slot))
      .map((digest): NotificationJob => ({
        kind: "digest",
        digest,
        accountId,
        day: slot.day.toString(),
      }));
  });
  const relay = await relayNotices(deps, scheduledTime.subtract(noticeSettling));

  const jobs = [...digests, ...relay.jobs];
  if (jobs.length > 0) {
    await deps.jobs.send(jobs);
  }
  // Only once queued: a run that fails before this reads the same events again, and the ledger drops the repeats
  if (relay.movedTo !== undefined) {
    const work = deps.startUnitOfWork();
    work.noticeCursor.save(relay.movedTo);
    await work.commit();
  }
  if (slot.time === timesOfDay[0]) {
    const before = now.subtract({ hours: deliveryRetentionDays * hoursPerDay });
    await deps.ledger.forget(before);
    const work = deps.startUnitOfWork();
    work.inbox.forget(before);
    await work.commit();
  }

  return { slot, digests: digests.length, notices: relay.jobs.length };
}
