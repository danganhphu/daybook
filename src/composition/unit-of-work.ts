import type {
  AccessEventWrites,
  AccountWrites,
  CeremonyWrites,
  PasskeyWrites,
  PasswordWrites,
  SessionWrites,
  SetupLinkWrites,
} from "@/features/access/application/access-writes";
import {
  createAccessEventWrites,
  createAccountWrites,
  createCeremonyWrites,
  createPasskeyWrites,
  createPasswordWrites,
  createSessionWrites,
  createSetupLinkWrites,
} from "@/features/access/infrastructure/access-writes";
import type { BookSettingWrites } from "@/features/book-settings/application/book-setting-writes";
import { createBookSettingWrites } from "@/features/book-settings/infrastructure/book-setting-writes";
import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import { createCaptureWrites } from "@/features/capture/infrastructure/capture-writes";
import type {
  CustomerAliasWrites,
  CustomerKindWrites,
  CustomerWrites,
} from "@/features/customers/application/customer-writes";
import {
  createCustomerAliasWrites,
  createCustomerKindWrites,
  createCustomerWrites,
} from "@/features/customers/infrastructure/customer-writes";
import type { MergeWrites } from "@/features/merging/application/merge-writes";
import { createMergeWrites } from "@/features/merging/infrastructure/merge-writes";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import { createNoteWrites } from "@/features/notes/infrastructure/note-writes";
import type {
  InboxWrites,
  NoticeCursorWrites,
  NotificationPreferenceWrites,
  PushSubscriptionWrites,
} from "@/features/notifications/application/notification-writes";
import {
  createInboxWrites,
  createNoticeCursorWrites,
  createNotificationPreferenceWrites,
  createPushSubscriptionWrites,
} from "@/features/notifications/infrastructure/notification-writes";
import type { OrderWrites } from "@/features/orders/application/order-writes";
import { createOrderWrites } from "@/features/orders/infrastructure/order-writes";
import type {
  ProductAliasWrites,
  ProductWrites,
} from "@/features/products/application/product-writes";
import {
  createProductAliasWrites,
  createProductWrites,
} from "@/features/products/infrastructure/product-writes";
import type { InterpretationWrites } from "@/features/reading/application/interpretation-writes";
import { createInterpretationWrites } from "@/features/reading/infrastructure/interpretation-writes";
import type { ReminderWrites } from "@/features/reminders/application/reminder-writes";
import { createReminderWrites } from "@/features/reminders/infrastructure/reminder-writes";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { createBatch, type Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

export type DaybookUnitOfWork = UnitOfWork<{
  readonly captures: CaptureWrites;
  readonly notes: NoteWrites;
  readonly customerKinds: CustomerKindWrites;
  readonly customers: CustomerWrites;
  readonly customerAliases: CustomerAliasWrites;
  readonly products: ProductWrites;
  readonly productAliases: ProductAliasWrites;
  readonly orders: OrderWrites;
  readonly reminders: ReminderWrites;
  readonly interpretations: InterpretationWrites;
  readonly merges: MergeWrites;
  readonly accounts: AccountWrites;
  readonly passkeys: PasskeyWrites;
  readonly passwords: PasswordWrites;
  readonly sessions: SessionWrites;
  readonly setupLinks: SetupLinkWrites;
  readonly ceremonies: CeremonyWrites;
  readonly accessEvents: AccessEventWrites;
  readonly pushSubscriptions: PushSubscriptionWrites;
  readonly notificationPreferences: NotificationPreferenceWrites;
  readonly noticeCursor: NoticeCursorWrites;
  readonly inbox: InboxWrites;
  readonly bookSettings: BookSettingWrites;
}>;

// Every feature's writes go into one batch, so whatever a use case touches commits as one D1 transaction
export function createUnitOfWork(db: Database, batch: Batch = createBatch(db)): DaybookUnitOfWork {
  return {
    captures: createCaptureWrites(db, batch),
    notes: createNoteWrites(db, batch),
    customerKinds: createCustomerKindWrites(db, batch),
    customers: createCustomerWrites(db, batch),
    customerAliases: createCustomerAliasWrites(db, batch),
    products: createProductWrites(db, batch),
    productAliases: createProductAliasWrites(db, batch),
    orders: createOrderWrites(db, batch),
    reminders: createReminderWrites(db, batch),
    interpretations: createInterpretationWrites(db, batch),
    merges: createMergeWrites(db, batch),
    accounts: createAccountWrites(db, batch),
    passkeys: createPasskeyWrites(db, batch),
    passwords: createPasswordWrites(db, batch),
    sessions: createSessionWrites(db, batch),
    setupLinks: createSetupLinkWrites(db, batch),
    ceremonies: createCeremonyWrites(db, batch),
    accessEvents: createAccessEventWrites(db, batch),
    pushSubscriptions: createPushSubscriptionWrites(db, batch),
    notificationPreferences: createNotificationPreferenceWrites(db, batch),
    noticeCursor: createNoticeCursorWrites(db, batch),
    inbox: createInboxWrites(db, batch),
    bookSettings: createBookSettingWrites(db, batch),
    commit: () => batch.commit(),
  };
}
