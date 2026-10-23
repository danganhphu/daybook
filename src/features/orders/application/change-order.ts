import type { Temporal } from "temporal-polyfill/implementation";

import type { Order, OrderId } from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import type { OrderChangeKind } from "@/features/orders/domain/order-change";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { OrderDeps } from "./order-deps";

// The shape every change to a stored order takes: read it, refuse a stale screen, apply the change, and write the
// order with its log entry in one batch
export async function changeOrder<T extends Order, E>(
  deps: Pick<OrderDeps, "clock" | "orders" | "startUnitOfWork">,
  input: RecordChange<OrderId>,
  kind: OrderChangeKind,
  apply: (order: Order, at: Temporal.Instant) => Result<T, E>,
): Promise<Result<T, E | "order_not_found" | "order_changed_elsewhere">> {
  const order = await deps.orders.get(input.id);
  if (order === undefined) {
    return err("order_not_found");
  }
  if (!Audits.isCurrent(order.audit, input.shown)) {
    return err("order_changed_elsewhere");
  }

  const changed = apply(order, deps.clock());
  if (!changed.ok) {
    return changed;
  }

  const work = deps.startUnitOfWork();
  work.orders.update(changed.value, OrderChanges.record(kind, order, changed.value));

  return (await commitUnlessStale(work)) === "stale" ? err("order_changed_elsewhere") : changed;
}
