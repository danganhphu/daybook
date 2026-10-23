import * as Orders from "@/features/orders/domain/order";
import type { DeletedOrder, OrderId } from "@/features/orders/domain/order";
import type { RecordChange } from "@/shared/application/record-change";
import { ok, type Result } from "@/shared/domain/result";

import { changeOrder } from "./change-order";
import type { OrderDeps } from "./order-deps";
import type { OrderError } from "./order-errors";

// Soft, with Undo. An order already deleted - by the other person, say - is answered as it is, with nothing written.
export async function deleteOrder(
  deps: OrderDeps,
  input: RecordChange<OrderId>,
): Promise<
  Result<DeletedOrder, Extract<OrderError, "order_not_found" | "order_changed_elsewhere">>
> {
  const order = await deps.orders.get(input.id);
  if (order?.status === "deleted") {
    return ok(order);
  }

  return changeOrder(deps, input, "deleted", (current, at) =>
    ok(Orders.markDeleted(current, input.by, at)),
  );
}

export function restoreOrder(deps: OrderDeps, input: RecordChange<OrderId>) {
  return changeOrder(deps, input, "restored", (order, at) => Orders.restore(order, input.by, at));
}
