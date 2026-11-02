import { env } from "cloudflare:workers";
import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { BotApi } from "@/bot/bot-api";
import { createFetchBotApi } from "@/bot/fetch-bot-api";
import type { ReplyJob } from "@/bot/reply-job";
import { createTelegramChannel } from "@/bot/telegram-channel";
import { reportUnanswered } from "@/bot/unanswered";
import { createAccessEventRepository } from "@/features/access/infrastructure/access-event-repository";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createTelegramLinkRepository } from "@/features/access/infrastructure/telegram-link-repository";
import { createCustomerRepository } from "@/features/customers/infrastructure/customer-repository";
import { createNoteRepository } from "@/features/notes/infrastructure/note-repository";
import {
  deliverNotification,
  type DeliveryOutcome,
} from "@/features/notifications/application/deliver-notification";
import type { JobSender } from "@/features/notifications/application/notification-job";
import type { PushSender } from "@/features/notifications/application/push-sender";
import { scheduleSlot } from "@/features/notifications/application/schedule-slot";
import { createDeliveryLedger } from "@/features/notifications/infrastructure/d1-delivery-ledger";
import { createInboxChannel } from "@/features/notifications/infrastructure/inbox-channel";
import { createNoticeCursorRepository } from "@/features/notifications/infrastructure/notice-cursor-repository";
import { createNotificationPreferenceRepository } from "@/features/notifications/infrastructure/notification-preference-repository";
import {
  createInboxWrites,
  createNoticeCursorWrites,
  createPushSubscriptionWrites,
} from "@/features/notifications/infrastructure/notification-writes";
import { createPushChannel } from "@/features/notifications/infrastructure/push-channel";
import { createPushSubscriptionRepository } from "@/features/notifications/infrastructure/push-subscription-repository";
import { createQueueJobSender } from "@/features/notifications/infrastructure/queue-job-sender";
import { vapidPairOrOff } from "@/features/notifications/infrastructure/vapid-config";
import { createWebPushSender } from "@/features/notifications/infrastructure/web-push-sender";
import { createReminderRepository } from "@/features/reminders/infrastructure/reminder-repository";
import { createReportQueries } from "@/features/reports/infrastructure/report-queries";
import { emptyExpiredTrash } from "@/features/trash/application/purge-from-trash";
import { createTrashWrites } from "@/features/trash/infrastructure/trash-writes";
import type { Job } from "@/jobs/job-message";
import type { Clock } from "@/shared/application/clock";
import { createBatch } from "@/shared/infrastructure/d1/batch";
import { createDatabase, type Database } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { appOriginBinding, d1Binding, queueBinding } from "./binding-schemas";
import { telegramConfigOrOff } from "./telegram-config";

// The composition root for work that happens off a request: the scheduler and the queue's consumer. Only what they
// use: the bot's reading and replying load only when a reply job comes.

export type JobBindings = {
  readonly db: D1Database;
  readonly jobs: JobSender;
  // None without VAPID keys: the list in the app still gets every job, and nothing goes out by push
  readonly pushSender: PushSender | undefined;
  // None without the bot's secrets: nothing goes to Telegram
  readonly telegram?: { readonly api: BotApi; readonly appOrigin: URL } | undefined;
  // Answers a message sent to the bot; none without a bot, and a reply job queued before it was removed is done
  readonly replyTo?: ((job: ReplyJob) => Promise<DeliveryOutcome>) | undefined;
};

const done: DeliveryOutcome = { kind: "done" };

// The stores these jobs write, on one batch
function jobsUnitOfWork(db: Database) {
  const batch = createBatch(db);

  return {
    noticeCursor: createNoticeCursorWrites(db, batch),
    pushSubscriptions: createPushSubscriptionWrites(db, batch),
    inbox: createInboxWrites(db, batch),
    commit: () => batch.commit(),
  };
}

function trashUnitOfWork(db: Database) {
  const batch = createBatch(db);

  return { trash: createTrashWrites(db, batch), commit: () => batch.commit() };
}

export function createJobs(bindings: JobBindings, clock: Clock = systemClock) {
  const db = createDatabase(bindings.db);
  const subscriptions = createPushSubscriptionRepository(db);
  const accessEvents = createAccessEventRepository(db);
  const accounts = createAccountRepository(db);
  const ledger = createDeliveryLedger(db);
  const preferences = createNotificationPreferenceRepository(db);
  const startUnitOfWork = () => jobsUnitOfWork(db);
  const { telegram, replyTo } = bindings;
  const channels = [
    createInboxChannel({ clock, startUnitOfWork }),
    ...(bindings.pushSender === undefined
      ? []
      : [
          createPushChannel({ clock, subscriptions, sender: bindings.pushSender, startUnitOfWork }),
        ]),
    ...(telegram === undefined
      ? []
      : [
          createTelegramChannel({
            clock,
            api: telegram.api,
            appOrigin: telegram.appOrigin,
            telegramLinks: createTelegramLinkRepository(db),
            preferences,
          }),
        ]),
  ];

  return {
    scheduleSlot: (scheduledTime: Temporal.Instant) =>
      scheduleSlot(
        {
          clock,
          accounts,
          preferences,
          accessEvents,
          noticeCursor: createNoticeCursorRepository(db),
          ledger,
          jobs: bindings.jobs,
          startUnitOfWork,
        },
        scheduledTime,
      ),
    deliver: (job: Job): Promise<DeliveryOutcome> => {
      if (job.kind === "reply") {
        return replyTo === undefined ? Promise.resolve(done) : replyTo(job);
      }

      return deliverNotification(
        {
          clock,
          ledger,
          channels,
          reminders: createReminderRepository(db),
          customers: createCustomerRepository(db),
          reports: createReportQueries(db),
          preferences,
          accessEvents,
          accounts,
        },
        job,
      );
    },
    emptyExpiredTrash: () =>
      emptyExpiredTrash({ clock, startUnitOfWork: () => trashUnitOfWork(db) }),
    reportUnanswered: (job: ReplyJob) =>
      reportUnanswered({ clock, notes: createNoteRepository(db), startUnitOfWork }, job),
  } as const;
}

const jobBindingsSchema = z.object({
  DB: d1Binding,
  JOBS: queueBinding,
  APP_ORIGIN: appOriginBinding,
});

// The bot, loaded on the first reply job: the same one the webhook uses
async function replyWithBot(job: ReplyJob): Promise<DeliveryOutcome> {
  const [{ bot }, { replyToMessage }] = await Promise.all([import("./bot"), import("@/bot/reply")]);
  const configured = bot();

  return configured === undefined ? done : replyToMessage(configured, job);
}

let checked: ReturnType<typeof createJobs> | undefined;

// The jobs over the Worker's real bindings, read on first use, as daybook() reads the app's. Push and the bot are
// optional: set up wrongly, each is off and says so in the logs (vapidPairOrOff, telegramConfigOrOff).
export function jobs(): ReturnType<typeof createJobs> {
  if (checked === undefined) {
    const parsed = jobBindingsSchema.parse(env);
    const pair = vapidPairOrOff(env, parsed.APP_ORIGIN);
    const telegram = telegramConfigOrOff(env, parsed.APP_ORIGIN);
    checked = createJobs({
      db: parsed.DB,
      jobs: createQueueJobSender(parsed.JOBS),
      pushSender:
        pair === undefined
          ? undefined
          : createWebPushSender({ ...pair, subject: parsed.APP_ORIGIN }),
      ...(telegram === undefined
        ? {}
        : {
            telegram: {
              api: createFetchBotApi({ token: telegram.token, origin: telegram.apiOrigin }),
              appOrigin: new URL(parsed.APP_ORIGIN),
            },
            replyTo: replyWithBot,
          }),
    });
  }

  return checked;
}
