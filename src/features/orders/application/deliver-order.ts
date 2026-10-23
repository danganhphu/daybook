import type { Temporal } from "temporal-polyfill/implementation";

import * as Orders from "@/features/orders/domain/order";
import type { OrderId } from "@/features/orders/domain/order";
import type { RecordChange } from "@/shared/application/record-change";

import { changeOrder } from "./change-order";
import type { OrderDeps } from "./order-deps";

export type DeliverOrderInput = RecordChange<OrderId> & { readonly on: Temporal.PlainDate };

// Marks it delivered on a day, or moves the day it was delivered
export function deliverOrder(deps: OrderDeps, input: DeliverOrderInput) {
  return changeOrder(deps, input, "delivered", (order, at) =>
    Orders.deliver(order, input.on, input.by, at),
  );
}

export function undeliverOrder(deps: OrderDeps, input: RecordChange<OrderId>) {
  return changeOrder(deps, input, "undelivered", (order, at) =>
    Orders.undeliver(order, input.by, at),
  );
}
