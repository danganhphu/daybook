import type { Temporal } from "temporal-polyfill/implementation";

import type { ReplySender } from "@/bot/reply-job";
import { linkTelegram, type LinkTelegramInput } from "@/features/access/application/link-telegram";
import type { TelegramUserId } from "@/features/access/domain/telegram-link";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createRateLimiter } from "@/features/access/infrastructure/d1-rate-limiter";
import { createTelegramLinkCodeRepository } from "@/features/access/infrastructure/telegram-link-code-repository";
import { createTelegramLinkRepository } from "@/features/access/infrastructure/telegram-link-repository";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import {
  recordMessage,
  type RecordMessageInput,
} from "@/features/capture/application/record-message";
import type { CaptureId } from "@/features/capture/domain/capture";
import { createCaptureRepository } from "@/features/capture/infrastructure/capture-repository";
import { createCustomerRepository } from "@/features/customers/infrastructure/customer-repository";
import { deleteNote } from "@/features/notes/application/delete-note";
import type { NoteChange } from "@/features/notes/application/note-change";
import { restoreNote } from "@/features/notes/application/restore-note";
import type { NoteId } from "@/features/notes/domain/note";
import { createNoteRepository } from "@/features/notes/infrastructure/note-repository";
import { dueItems, periodSummary } from "@/features/notifications/application/compose-content";
import { createNotificationPreferenceRepository } from "@/features/notifications/infrastructure/notification-preference-repository";
import { deleteOrder, restoreOrder } from "@/features/orders/application/delete-order";
import type { OrderFilter } from "@/features/orders/application/order-queries";
import type { OrderId } from "@/features/orders/domain/order";
import { createOrderQueries } from "@/features/orders/infrastructure/order-queries";
import { createOrderRepository } from "@/features/orders/infrastructure/order-repository";
import { createProductRepository } from "@/features/products/infrastructure/product-repository";
import {
  answerReading,
  type AnswerReadingInput,
} from "@/features/reading/application/answer-reading";
import type { MessageReader } from "@/features/reading/application/message-reader";
import { readNote, type ReadNoteInput } from "@/features/reading/application/read-note";
import type { ReadingDeps } from "@/features/reading/application/reading-deps";
import { readingStates } from "@/features/reading/application/reading-states";
import { createInterpretationRepository } from "@/features/reading/infrastructure/interpretation-repository";
import { completeReminder } from "@/features/reminders/application/complete-reminder";
import { deleteReminder, restoreReminder } from "@/features/reminders/application/delete-reminder";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { OpenReminderFilter } from "@/features/reminders/domain/reminder-repository";
import { createReminderRepository } from "@/features/reminders/infrastructure/reminder-repository";
import { createReportQueries } from "@/features/reports/infrastructure/report-queries";
import type { Clock } from "@/shared/application/clock";
import type { RecordChange } from "@/shared/application/record-change";
import type { AccountId } from "@/shared/domain/account-id";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { createUnitOfWork } from "./unit-of-work";

export type BotApp = ReturnType<typeof createBotApp>;

export type BotAppBindings = {
  readonly db: D1Database;
  // None where no model is bound: messages are kept as notes and answered "Đã lưu."
  readonly reader: MessageReader | undefined;
  readonly replies: ReplySender;
};

// The composition root for the Telegram door: only the use cases a message, a button or a command reaches, beside
// the web's createApp. Adapters receive a BotApp and never reach past it.
export function createBotApp(bindings: BotAppBindings, clock: Clock = systemClock) {
  const db = createDatabase(bindings.db);
  const notes = createNoteRepository(db);
  const captures = createCaptureRepository(db);
  const customers = createCustomerRepository(db);
  const products = createProductRepository(db);
  const orders = createOrderRepository(db);
  const orderQueries = createOrderQueries(db);
  const reminders = createReminderRepository(db);
  const accounts = createAccountRepository(db);
  const telegramLinks = createTelegramLinkRepository(db);
  const startUnitOfWork = () => createUnitOfWork(db);
  const reading: ReadingDeps = {
    clock,
    reader: bindings.reader,
    notes,
    captures,
    interpretations: createInterpretationRepository(db),
    customers,
    products,
    orderQueries,
    reminders,
    startUnitOfWork,
  };
  const orderBook = { clock, orders, customers, products, startUnitOfWork };
  const reminderBook = { clock, reminders, customers, notes, startUnitOfWork };
  const noteBook = { clock, notes, startUnitOfWork };
  const summaries = {
    reports: createReportQueries(db),
    preferences: createNotificationPreferenceRepository(db),
  };
  const today = () => vietnamDate(clock());

  return {
    today,
    replies: bindings.replies,

    linkFor: (telegramUserId: TelegramUserId) => telegramLinks.findByTelegramUser(telegramUserId),
    linkTelegram: (input: LinkTelegramInput) =>
      linkTelegram(
        {
          clock,
          secrets: webCryptoSecrets,
          rateLimiter: createRateLimiter(db),
          telegramLinks,
          telegramLinkCodes: createTelegramLinkCodeRepository(db),
          startUnitOfWork,
        },
        input,
      ),
    displayName: async (accountId: AccountId) => (await accounts.get(accountId))?.displayName,

    recordMessage: (input: RecordMessageInput) =>
      recordMessage({ clock, captures, notes, startUnitOfWork }, input),
    getNote: (id: NoteId) => notes.get(id),
    noteFrom: (captureId: CaptureId) => notes.findByCapture(captureId),
    deleteNote: (input: NoteChange) => deleteNote(noteBook, input),
    restoreNote: (input: NoteChange) => restoreNote(noteBook, input),

    canRead: () => bindings.reader !== undefined,
    readNote: (input: ReadNoteInput) => readNote(reading, input),
    answerReading: (input: AnswerReadingInput) => answerReading(reading, input),
    readingState: async (captureId: CaptureId) =>
      (await readingStates(reading, [captureId])).get(captureId),

    getOrder: (id: OrderId) => orders.get(id),
    listOrders: (filter: OrderFilter, limit: number) => orderQueries.list(filter, limit),
    orderTotals: (filter: OrderFilter) => orderQueries.totals(filter),
    deleteOrder: (input: RecordChange<OrderId>) => deleteOrder(orderBook, input),
    restoreOrder: (input: RecordChange<OrderId>) => restoreOrder(orderBook, input),

    getReminder: (id: ReminderId) => reminders.get(id),
    dueReminders: async (filter: OpenReminderFilter, limit: number) =>
      dueItems(customers, await reminders.listOpen(filter, limit)),
    deleteReminder: (input: RecordChange<ReminderId>) => deleteReminder(reminderBook, input),
    restoreReminder: (input: RecordChange<ReminderId>) => restoreReminder(reminderBook, input),
    completeReminder: (input: RecordChange<ReminderId>) => completeReminder(reminderBook, input),

    periodSummary: (accountId: AccountId, period: "week" | "month", day: Temporal.PlainDate) =>
      periodSummary(summaries, accountId, period, day),
  } as const;
}
