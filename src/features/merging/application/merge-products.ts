import type { Temporal } from "temporal-polyfill/implementation";

import * as Merges from "@/features/merging/domain/merge";
import type { ProductMerge } from "@/features/merging/domain/merge";
import * as Orders from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import * as Products from "@/features/products/domain/product";
import type { ActiveProduct, Product, ProductId } from "@/features/products/domain/product";
import * as ProductAliases from "@/features/products/domain/product-alias";
import type { ProductAlias } from "@/features/products/domain/product-alias";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchText } from "@/shared/domain/search-text";

import type { MergeInput, MergingDeps } from "./merging-deps";
import type { MergeError } from "./merging-errors";

export type ProductMergeError = Extract<
  MergeError,
  | "merge_into_itself"
  | "product_not_found"
  | "product_changed_elsewhere"
  | "product_merged"
  | "product_kept_unavailable"
>;

// The merged product's names, as the kept one's other names: its own name, unless something else already answers to
// it, and every other name it had, which move with it. One name, one product.
async function namesToKeep(
  products: ProductRepository,
  from: Product,
  fromAliases: ReadonlyArray<ProductAlias>,
  into: ActiveProduct,
  by: AccountId,
  at: Temporal.Instant,
): Promise<ReadonlyArray<ProductAlias>> {
  const [intoAliases, holder, aliasHolder] = await Promise.all([
    products.aliasesOf(into.id),
    products.findActiveNamed([from.name]),
    products.findAliasNamed(from.name),
  ]);
  const held = new Set([into.name, ...intoAliases.map((alias) => alias.name)].map(searchText));
  const answeredElsewhere =
    [...holder.values()].some((product) => product.id !== from.id && product.id !== into.id) ||
    (aliasHolder !== undefined && aliasHolder.productId !== from.id);

  const names = [
    ...(answeredElsewhere ? [] : [from.name]),
    ...fromAliases.map((alias) => alias.name),
  ].filter((name) => !held.has(searchText(name)));

  return names.map((name) => ProductAliases.create(into.id, name, by, at));
}

// Two products that are one: every order line of the first moves to the second at its own quantity and price, each
// order's log says so, the first is hidden naming the second, and its names become the second's other names. One
// batch; no Undo, so the screen confirms first, and the merge is recorded.
export async function mergeProducts(
  deps: MergingDeps,
  input: MergeInput<ProductId>,
): Promise<Result<ProductMerge, ProductMergeError>> {
  if (input.id === input.into) {
    return err("merge_into_itself");
  }
  const [from, into] = await Promise.all([
    deps.products.get(input.id),
    deps.products.get(input.into),
  ]);
  if (from === undefined) {
    return err("product_not_found");
  }
  if (!Audits.isCurrent(from.audit, input.shown)) {
    return err("product_changed_elsewhere");
  }
  if (into?.status !== "active") {
    return err("product_kept_unavailable");
  }

  const at = deps.clock();
  const merged = Products.mergeInto(from, into, input.by, at);
  if (!merged.ok) {
    return merged;
  }

  const [orders, fromAliases] = await Promise.all([
    deps.orders.withProduct(from.id),
    deps.products.aliasesOf(from.id),
  ]);
  const names = await namesToKeep(deps.products, from, fromAliases, into, input.by, at);
  const record = Merges.productMerge(
    from.id,
    into.id,
    orders.map((order) => order.id),
    input.by,
    at,
  );

  // Both products first, so a change either one saw since it was read aborts the batch before anything moves. Its
  // names are removed before they are added to the kept one: no two products hold one name, even within the batch.
  const work = deps.startUnitOfWork();
  work.products.update(merged.value);
  work.products.update(Products.absorbMerge(into, input.by, at));
  for (const order of orders) {
    const moved = Orders.replaceProduct(order, from.id, into.id, input.by, at);
    work.orders.update(moved, OrderChanges.record("product_merged", order, moved));
  }
  work.productAliases.remove(fromAliases.map((alias) => alias.id));
  work.productAliases.add(names);
  work.merges.addProductMerge(record);

  return (await commitUnlessStale(work)) === "stale"
    ? err("product_changed_elsewhere")
    : ok(record);
}
