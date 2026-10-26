import type {
  CustomerAliasWrites,
  CustomerWrites,
} from "@/features/customers/application/customer-writes";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { OrderWrites } from "@/features/orders/application/order-writes";
import type { OrderRepository } from "@/features/orders/domain/order-repository";
import type {
  ProductAliasWrites,
  ProductWrites,
} from "@/features/products/application/product-writes";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { ReminderWrites } from "@/features/reminders/application/reminder-writes";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Clock } from "@/shared/application/clock";
import type { RecordChange } from "@/shared/application/record-change";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { MergeWrites } from "./merge-writes";

// A merge touches customers or products, the orders and reminders that point at them, and leaves its record: all on
// one unit of work, so it lands whole or not at all
export type MergingDeps = {
  readonly clock: Clock;
  readonly customers: CustomerRepository;
  readonly products: ProductRepository;
  readonly orders: OrderRepository;
  readonly reminders: ReminderRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly customers: CustomerWrites;
    readonly customerAliases: CustomerAliasWrites;
    readonly products: ProductWrites;
    readonly productAliases: ProductAliasWrites;
    readonly orders: OrderWrites;
    readonly reminders: ReminderWrites;
    readonly merges: MergeWrites;
  }>;
};

// Which record to merge, as the screen showed it, and the one to keep
export type MergeInput<Id> = RecordChange<Id> & { readonly into: Id };
