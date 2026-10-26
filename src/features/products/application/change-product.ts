import type { Temporal } from "temporal-polyfill/implementation";

import type { Product, ProductId } from "@/features/products/domain/product";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { ProductDeps } from "./product-deps";

// Read the product, refuse a stale screen, apply the change, write it
export async function changeProduct<T extends Product, E>(
  deps: ProductDeps,
  input: RecordChange<ProductId>,
  apply: (product: Product, at: Temporal.Instant) => Promise<Result<T, E>> | Result<T, E>,
): Promise<Result<T, E | "product_not_found" | "product_changed_elsewhere">> {
  const product = await deps.products.get(input.id);
  if (product === undefined) {
    return err("product_not_found");
  }
  if (!Audits.isCurrent(product.audit, input.shown)) {
    return err("product_changed_elsewhere");
  }

  const changed = await apply(product, deps.clock());
  if (!changed.ok) {
    return changed;
  }

  const work = deps.startUnitOfWork();
  work.products.update(changed.value);

  return (await commitUnlessStale(work)) === "stale" ? err("product_changed_elsewhere") : changed;
}
