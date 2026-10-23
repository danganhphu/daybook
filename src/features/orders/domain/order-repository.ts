import type { Order, OrderId } from "./order";

// Reads only; writes go through the unit of work
export type OrderRepository = {
  // With its lines in order and every payment, removed ones included
  get(id: OrderId): Promise<Order | undefined>;
};
