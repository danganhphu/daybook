import type { LiveOrder, Order } from "@/features/orders/domain/order";
import type { OrderChange } from "@/features/orders/domain/order-change";

// Queues order changes on the current unit of work. Each write takes the change-log entry with it, so no change to an
// order can be stored without its trail.
export type OrderWrites = {
  add(order: LiveOrder, change: OrderChange): void;
  update(order: Order, change: OrderChange): void;
};
