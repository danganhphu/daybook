import * as Products from "@/features/products/domain/product";
import type { ActiveProduct, ArchivedProduct, ProductId } from "@/features/products/domain/product";
import type { RecordChange } from "@/shared/application/record-change";
import { err, type Result } from "@/shared/domain/result";

import { changeProduct } from "./change-product";
import { nameTaken } from "./name-check";
import type { ProductDeps } from "./product-deps";
import type { ProductError } from "./product-errors";

export function archiveProduct(
  deps: ProductDeps,
  input: RecordChange<ProductId>,
): Promise<
  Result<
    ArchivedProduct,
    Extract<ProductError, "product_not_found" | "product_changed_elsewhere" | "product_archived">
  >
> {
  return changeProduct(deps, input, (product, at) => Products.archive(product, input.by, at));
}

// Back in the suggestions, if no shown product has taken its name since
export function restoreProduct(
  deps: ProductDeps,
  input: RecordChange<ProductId>,
): Promise<
  Result<
    ActiveProduct,
    Extract<
      ProductError,
      | "product_not_found"
      | "product_changed_elsewhere"
      | "product_not_archived"
      | "product_merged"
      | "product_name_taken"
    >
  >
> {
  return changeProduct(deps, input, async (product, at) => {
    const restored = Products.restore(product, input.by, at);
    if (!restored.ok) {
      return restored;
    }

    return (await nameTaken(deps.products, product.name, product.id))
      ? err("product_name_taken" as const)
      : restored;
  });
}
