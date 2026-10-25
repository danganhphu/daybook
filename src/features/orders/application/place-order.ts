import * as Orders from "@/features/orders/domain/order";
import type { LiveOrder } from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import type { ProductWrites } from "@/features/products/application/product-writes";
import type { ActiveProduct } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { OrderDeps } from "./order-deps";
import type { OrderError } from "./order-errors";
import type { OrderInput } from "./order-input";
import type { OrderWrites } from "./order-writes";
import { resolveLines } from "./resolve-lines";

export type PlaceOrderInput = { readonly by: AccountId; readonly order: OrderInput };

export type PlaceOrderError = Extract<
  OrderError,
  "customer_unavailable" | "product_not_found" | "order_too_large"
>;

// An order ready to write, with the products it names for the first time
export type PreparedOrder = {
  readonly order: LiveOrder;
  readonly created: ReadonlyArray<ActiveProduct>;
};

// Everything placing an order checks, without writing it, so a caller can write it in a batch of its own
export async function prepareOrder(
  deps: Pick<OrderDeps, "clock" | "customers" | "products">,
  input: PlaceOrderInput,
): Promise<Result<PreparedOrder, PlaceOrderError>> {
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

  return placed.ok ? ok({ order: placed.value, created: resolved.value.created }) : placed;
}

// The order, its new products and the first line of its change log, in the caller's batch
export function writeOrder(
  work: { readonly orders: OrderWrites; readonly products: ProductWrites },
  prepared: PreparedOrder,
): void {
  work.products.add(prepared.created);
  work.orders.add(prepared.order, OrderChanges.record("placed", undefined, prepared.order));
}

// For a customer in the list. New product names become products in the same batch as the order.
export async function placeOrder(
  deps: OrderDeps,
  input: PlaceOrderInput,
): Promise<Result<LiveOrder, PlaceOrderError>> {
  const prepared = await prepareOrder(deps, input);
  if (!prepared.ok) {
    return prepared;
  }

  const work = deps.startUnitOfWork();
  writeOrder(work, prepared.value);
  await work.commit();

  return ok(prepared.value.order);
}
