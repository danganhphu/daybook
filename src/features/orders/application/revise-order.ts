import * as Orders from "@/features/orders/domain/order";
import type { LiveOrder, OrderId } from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { OrderDeps } from "./order-deps";
import type { OrderError } from "./order-errors";
import type { OrderInput } from "./order-input";
import { resolveLines } from "./resolve-lines";

export type ReviseOrderInput = RecordChange<OrderId> & { readonly order: OrderInput };

// Not done through changeOrder: a revision may name new products, which go into the same batch
export async function reviseOrder(
  deps: OrderDeps,
  input: ReviseOrderInput,
): Promise<
  Result<
    LiveOrder,
    Extract<
      OrderError,
      | "order_not_found"
      | "order_changed_elsewhere"
      | "order_deleted"
      | "order_too_large"
      | "total_below_paid"
      | "delivered_before_ordered"
      | "customer_unavailable"
      | "product_not_found"
    >
  >
> {
  const order = await deps.orders.get(input.id);
  if (order === undefined) {
    return err("order_not_found");
  }
  if (!Audits.isCurrent(order.audit, input.shown)) {
    return err("order_changed_elsewhere");
  }
  // Another customer must be in the list; the one the order has may have been hidden since
  if (input.order.customerId !== order.customerId) {
    const customer = await deps.customers.get(input.order.customerId);
    if (customer?.status !== "active") {
      return err("customer_unavailable");
    }
  }

  const at = deps.clock();
  const resolved = await resolveLines(deps.products, input.order.lines, input.by, at);
  if (!resolved.ok) {
    return resolved;
  }

  const revised = Orders.revise(
    order,
    { ...input.order, lines: resolved.value.lines },
    input.by,
    at,
  );
  if (!revised.ok) {
    return revised;
  }

  const work = deps.startUnitOfWork();
  work.products.add(resolved.value.created);
  work.orders.update(revised.value, OrderChanges.record("revised", order, revised.value));

  return (await commitUnlessStale(work)) === "stale" ? err("order_changed_elsewhere") : revised;
}
