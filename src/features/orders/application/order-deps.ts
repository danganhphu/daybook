import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { OrderRepository } from "@/features/orders/domain/order-repository";
import type { ProductWrites } from "@/features/products/application/product-writes";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { OrderWrites } from "./order-writes";

// What the order use cases need. Products named for the first time are written beside the order, in its batch.
export type OrderDeps = {
  readonly clock: Clock;
  readonly orders: OrderRepository;
  readonly customers: CustomerRepository;
  readonly products: ProductRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly orders: OrderWrites;
    readonly products: ProductWrites;
  }>;
};
