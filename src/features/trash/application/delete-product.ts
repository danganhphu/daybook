import type { ProductError } from "@/features/products/application/product-errors";
import * as Products from "@/features/products/domain/product";
import type { ArchivedProduct, ProductId } from "@/features/products/domain/product";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { TrashDeps } from "./trash-deps";

// How many orders sell the product, deleted ones included: one that any order names is hidden, never deleted, so the
// order keeps the name it was sold under (the owner, 2026-10-29)
export async function productOrderCount(
  deps: Pick<TrashDeps, "orders">,
  id: ProductId,
): Promise<number> {
  return (await deps.orders.withProduct(id)).length;
}

export async function deleteProduct(
  deps: TrashDeps,
  input: RecordChange<ProductId>,
): Promise<
  Result<
    ArchivedProduct,
    Extract<
      ProductError,
      | "product_not_found"
      | "product_changed_elsewhere"
      | "product_merged"
      | "product_deleted"
      | "product_in_orders"
    >
  >
> {
  const product = await deps.products.get(input.id);
  if (product === undefined) {
    return err("product_not_found");
  }
  if (!Audits.isCurrent(product.audit, input.shown)) {
    return err("product_changed_elsewhere");
  }
  if ((await productOrderCount(deps, product.id)) > 0) {
    return err("product_in_orders");
  }

  const deleted = Products.markDeleted(product, input.by, deps.clock());
  if (!deleted.ok) {
    return deleted;
  }

  const work = deps.startUnitOfWork();
  work.products.update(deleted.value);

  return (await commitUnlessStale(work)) === "stale" ? err("product_changed_elsewhere") : deleted;
}
