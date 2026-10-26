import type { CustomerId } from "@/features/customers/domain/customer";
import type { ProductId } from "@/features/products/domain/product";

import type { MergingDeps } from "./merging-deps";

// What a merge will move, for the screen to say before it is confirmed. Deleted orders and reminders move too, but
// nobody counts what they cannot see.
export type MergePreview = {
  readonly orders: number;
  readonly reminders: number;
};

export async function customerMergePreview(
  deps: Pick<MergingDeps, "orders" | "reminders">,
  from: CustomerId,
): Promise<MergePreview> {
  const [orders, reminders] = await Promise.all([
    deps.orders.forCustomer(from),
    deps.reminders.forCustomer(from),
  ]);

  return {
    orders: orders.filter((order) => order.status === "live").length,
    reminders: reminders.filter((reminder) => reminder.status === "live").length,
  };
}

export async function productMergePreview(
  deps: Pick<MergingDeps, "orders">,
  from: ProductId,
): Promise<MergePreview> {
  const orders = await deps.orders.withProduct(from);

  return { orders: orders.filter((order) => order.status === "live").length, reminders: 0 };
}
