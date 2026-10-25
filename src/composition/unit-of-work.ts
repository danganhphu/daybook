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
import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import { createCaptureWrites } from "@/features/capture/infrastructure/capture-writes";
import type {
  CustomerKindWrites,
  CustomerWrites,
} from "@/features/customers/application/customer-writes";
import {
  createCustomerKindWrites,
  createCustomerWrites,
} from "@/features/customers/infrastructure/customer-writes";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import { createNoteWrites } from "@/features/notes/infrastructure/note-writes";
import type { OrderWrites } from "@/features/orders/application/order-writes";
import { createOrderWrites } from "@/features/orders/infrastructure/order-writes";
import type { ProductWrites } from "@/features/products/application/product-writes";
import { createProductWrites } from "@/features/products/infrastructure/product-writes";
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
  readonly products: ProductWrites;
  readonly orders: OrderWrites;
  readonly reminders: ReminderWrites;
  readonly interpretations: InterpretationWrites;
  readonly accounts: AccountWrites;
  readonly passkeys: PasskeyWrites;
  readonly passwords: PasswordWrites;
  readonly sessions: SessionWrites;
  readonly setupLinks: SetupLinkWrites;
  readonly ceremonies: CeremonyWrites;
  readonly accessEvents: AccessEventWrites;
}>;

// Every feature's writes go into one batch, so whatever a use case touches commits as one D1 transaction
export function createUnitOfWork(db: Database, batch: Batch = createBatch(db)): DaybookUnitOfWork {
  return {
    captures: createCaptureWrites(db, batch),
    notes: createNoteWrites(db, batch),
    customerKinds: createCustomerKindWrites(db, batch),
    customers: createCustomerWrites(db, batch),
    products: createProductWrites(db, batch),
    orders: createOrderWrites(db, batch),
    reminders: createReminderWrites(db, batch),
    interpretations: createInterpretationWrites(db, batch),
    accounts: createAccountWrites(db, batch),
    passkeys: createPasskeyWrites(db, batch),
    passwords: createPasswordWrites(db, batch),
    sessions: createSessionWrites(db, batch),
    setupLinks: createSetupLinkWrites(db, batch),
    ceremonies: createCeremonyWrites(db, batch),
    accessEvents: createAccessEventWrites(db, batch),
    commit: () => batch.commit(),
  };
}
