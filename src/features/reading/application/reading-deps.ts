import type { CaptureRepository } from "@/features/capture/domain/capture-repository";
import type { CustomerWrites } from "@/features/customers/application/customer-writes";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { OrderQueries } from "@/features/orders/application/order-queries";
import type { OrderWrites } from "@/features/orders/application/order-writes";
import type { ProductWrites } from "@/features/products/application/product-writes";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { InterpretationRepository } from "@/features/reading/domain/interpretation-repository";
import type { ReminderWrites } from "@/features/reminders/application/reminder-writes";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { InterpretationWrites } from "./interpretation-writes";
import type { MessageReader } from "./message-reader";

// What reading needs. A reading and what it makes - an order with its new products, a reminder, a customer a person
// added - are written in one batch.
export type ReadingDeps = {
  readonly clock: Clock;
  // None where no model is bound: the end-to-end build, a Worker without its AI binding
  readonly reader: MessageReader | undefined;
  readonly notes: NoteRepository;
  readonly captures: CaptureRepository;
  readonly interpretations: InterpretationRepository;
  readonly customers: CustomerRepository;
  readonly products: ProductRepository;
  readonly orderQueries: Pick<OrderQueries, "lastPrices" | "madeFrom">;
  readonly reminders: Pick<ReminderRepository, "madeFrom">;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly interpretations: InterpretationWrites;
    readonly orders: OrderWrites;
    readonly products: ProductWrites;
    readonly reminders: ReminderWrites;
    readonly customers: CustomerWrites;
  }>;
};
