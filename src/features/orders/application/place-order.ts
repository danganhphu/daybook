import * as Orders from "@/features/orders/domain/order";
import type { LiveOrder } from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import type { AccountId } from "@/shared/domain/account-id";
import { err, type Result } from "@/shared/domain/result";

import type { OrderDeps } from "./order-deps";
import type { OrderError } from "./order-errors";
import type { OrderInput } from "./order-input";
import { resolveLines } from "./resolve-lines";

export type PlaceOrderInput = { readonly by: AccountId; readonly order: OrderInput };

// For a customer in the list. New product names become products in the same batch as the order.
export async function placeOrder(
  deps: OrderDeps,
  input: PlaceOrderInput,
): Promise<
  Result<
    LiveOrder,
    Extract<OrderError, "customer_unavailable" | "product_not_found" | "order_too_large">
  >
> {
  const customer = await deps.customers.get(input.order.customerId);
  if (customer?.status !== "active") {
    return err("customer_unavailable");
  }

  const at = deps.clock();
  const resolved = await resolveLines(deps.products, input.order.lines, input.by, at);
  if (!resolved.ok) {
    return resolved;
  }

  const placed = Orders.place({ ...input.order, lines: resolved.value.lines }, input.by, at);
  if (!placed.ok) {
    return placed;
  }

  const work = deps.startUnitOfWork();
  work.products.add(resolved.value.created);
  work.orders.add(placed.value, OrderChanges.record("placed", undefined, placed.value));
  await work.commit();

  return placed;
}
