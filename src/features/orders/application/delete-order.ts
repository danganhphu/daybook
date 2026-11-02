import * as Customers from "@/features/customers/domain/customer";
import * as Orders from "@/features/orders/domain/order";
import type { DeletedOrder, OrderId } from "@/features/orders/domain/order";
import type { RecordChange } from "@/shared/application/record-change";
import { err, ok, type Result } from "@/shared/domain/result";

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

// Never while its customer is in the trash: restoring the customer brings back the orders deleted with them, and an
// order alive under a deleted customer would keep that customer from ever being deleted for good. One deleted with
// its customer is refused by the domain, with its own words.
export async function restoreOrder(deps: OrderDeps, input: RecordChange<OrderId>) {
  const order = await deps.orders.get(input.id);
  if (
    order?.status === "deleted" &&
    order.deletedWith === undefined &&
    Customers.isInTrash(await deps.customers.get(order.customerId))
  ) {
    return err("order_customer_deleted" as const);
  }

  return changeOrder(deps, input, "restored", (current, at) =>
    Orders.restore(current, input.by, at),
  );
}
