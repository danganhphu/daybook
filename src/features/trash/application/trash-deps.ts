import type {
  CustomerKindWrites,
  CustomerWrites,
} from "@/features/customers/application/customer-writes";
import type { CustomerKindRepository } from "@/features/customers/domain/customer-kind-repository";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { OrderWrites } from "@/features/orders/application/order-writes";
import type { OrderRepository } from "@/features/orders/domain/order-repository";
import type { ProductWrites } from "@/features/products/application/product-writes";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { ReminderWrites } from "@/features/reminders/application/reminder-writes";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { TrashWrites } from "./trash-writes";

// The trash reaches every kind of thing that can be deleted, and a customer's delete reaches their orders and
// reminders: all on one unit of work, so each lands whole or not at all
export type TrashDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly orders: OrderRepository;
  readonly reminders: ReminderRepository;
  readonly customers: CustomerRepository;
  readonly products: ProductRepository;
  readonly kinds: CustomerKindRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly notes: NoteWrites;
    readonly orders: OrderWrites;
    readonly reminders: ReminderWrites;
    readonly customers: CustomerWrites;
    readonly products: ProductWrites;
    readonly customerKinds: CustomerKindWrites;
    readonly trash: TrashWrites;
  }>;
};
