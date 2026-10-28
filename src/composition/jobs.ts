import { env } from "cloudflare:workers";
import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { createAccessEventRepository } from "@/features/access/infrastructure/access-event-repository";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createBookSettingRepository } from "@/features/book-settings/infrastructure/book-setting-repository";
import { createCustomerRepository } from "@/features/customers/infrastructure/customer-repository";
import { deliverNotification } from "@/features/notifications/application/deliver-notification";
import type {
  JobSender,
  NotificationJob,
} from "@/features/notifications/application/notification-job";
import type { PushSender } from "@/features/notifications/application/push-sender";
import { scheduleSlot } from "@/features/notifications/application/schedule-slot";
import { createDeliveryLedger } from "@/features/notifications/infrastructure/d1-delivery-ledger";
import { createNoticeCursorRepository } from "@/features/notifications/infrastructure/notice-cursor-repository";
import { createNotificationPreferenceRepository } from "@/features/notifications/infrastructure/notification-preference-repository";
import {
  createNoticeCursorWrites,
  createPushSubscriptionWrites,
} from "@/features/notifications/infrastructure/notification-writes";
import { createPushChannel } from "@/features/notifications/infrastructure/push-channel";
import { createPushSubscriptionRepository } from "@/features/notifications/infrastructure/push-subscription-repository";
import { createQueueJobSender } from "@/features/notifications/infrastructure/queue-job-sender";
import {
  vapidBindingsSchema,
  vapidPairFrom,
} from "@/features/notifications/infrastructure/vapid-config";
import { createWebPushSender } from "@/features/notifications/infrastructure/web-push-sender";
import { createReminderRepository } from "@/features/reminders/infrastructure/reminder-repository";
import { createReportQueries } from "@/features/reports/infrastructure/report-queries";
import type { Clock } from "@/shared/application/clock";
import { createBatch } from "@/shared/infrastructure/d1/batch";
import { createDatabase, type Database } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

// The composition root for work that happens off a request: the scheduler and the queue's consumer. Only what they
// use, so a cron run on a fresh isolate loads none of the web's use cases.

export type JobBindings = {
  readonly db: D1Database;
  readonly jobs: JobSender;
  // None without VAPID keys: the scheduler still plans, and a job finds no channel to send on
  readonly pushSender: PushSender | undefined;
};

// The two stores these jobs write, on one batch
function jobsUnitOfWork(db: Database) {
  const batch = createBatch(db);

  return {
    noticeCursor: createNoticeCursorWrites(db, batch),
    pushSubscriptions: createPushSubscriptionWrites(db, batch),
    commit: () => batch.commit(),
  };
}

export function createJobs(bindings: JobBindings, clock: Clock = systemClock) {
  const db = createDatabase(bindings.db);
  const subscriptions = createPushSubscriptionRepository(db);
  const accessEvents = createAccessEventRepository(db);
  const ledger = createDeliveryLedger(db);
  const startUnitOfWork = () => jobsUnitOfWork(db);
  const channels =
    bindings.pushSender === undefined
      ? []
      : [createPushChannel({ clock, subscriptions, sender: bindings.pushSender, startUnitOfWork })];

  return {
    scheduleSlot: (scheduledTime: Temporal.Instant) =>
      scheduleSlot(
        {
          clock,
          subscriptions,
          preferences: createNotificationPreferenceRepository(db),
          accessEvents,
          noticeCursor: createNoticeCursorRepository(db),
          ledger,
          jobs: bindings.jobs,
          startUnitOfWork,
        },
        scheduledTime,
      ),
    deliver: (job: NotificationJob) =>
      deliverNotification(
        {
          clock,
          ledger,
          channels,
          reminders: createReminderRepository(db),
          customers: createCustomerRepository(db),
          reports: createReportQueries(db),
          settings: createBookSettingRepository(db),
          accessEvents,
          accounts: createAccountRepository(db),
        },
        job,
      ),
  } as const;
}

const jobBindingsSchema = z
  .object({
    DB: z.custom<D1Database>(
      (value) => typeof value === "object" && value !== null && "prepare" in value,
      { error: "The D1 binding DB is missing" },
    ),
    JOBS: z.custom<Queue>(
      (value) => typeof value === "object" && value !== null && "sendBatch" in value,
      { error: "The queue binding JOBS is missing" },
    ),
    APP_ORIGIN: z.url({ error: "The APP_ORIGIN secret is missing or not a URL" }),
  })
  .extend(vapidBindingsSchema.shape);

let checked: ReturnType<typeof createJobs> | undefined;

// The jobs over the Worker's real bindings, read on first use, as daybook() reads the app's
export function jobs(): ReturnType<typeof createJobs> {
  if (checked === undefined) {
    const parsed = jobBindingsSchema.parse(env);
    const pair = vapidPairFrom(parsed, parsed.APP_ORIGIN);
    checked = createJobs({
      db: parsed.DB,
      jobs: createQueueJobSender(parsed.JOBS),
      pushSender:
        pair === undefined
          ? undefined
          : createWebPushSender({ ...pair, subject: parsed.APP_ORIGIN }),
    });
  }

  return checked;
}
