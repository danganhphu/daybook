import type { CustomerId } from "@/features/customers/domain/customer";
import type { ProductId } from "@/features/products/domain/product";

import type { Order, OrderId } from "./order";

// Reads only; writes go through the unit of work
export type OrderRepository = {
  // With its lines in order and every payment, removed ones included
  get(id: OrderId): Promise<Order | undefined>;
  // Every order of the customer, deleted ones included, whole
  forCustomer(customerId: CustomerId): Promise<ReadonlyArray<Order>>;
  // Every order with a line of the product, deleted ones included, whole
  withProduct(productId: ProductId): Promise<ReadonlyArray<Order>>;
};
