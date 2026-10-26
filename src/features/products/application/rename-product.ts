import * as Products from "@/features/products/domain/product";
import type { Product, ProductId, ProductName } from "@/features/products/domain/product";
import type { RecordChange } from "@/shared/application/record-change";
import { err, ok, type Result } from "@/shared/domain/result";

import { changeProduct } from "./change-product";
import { nameTaken } from "./name-check";
import type { ProductDeps } from "./product-deps";
import type { ProductError } from "./product-errors";

export type RenameProductInput = RecordChange<ProductId> & { readonly name: ProductName };

export function renameProduct(
  deps: ProductDeps,
  input: RenameProductInput,
): Promise<
  Result<
    Product,
    Extract<ProductError, "product_not_found" | "product_changed_elsewhere" | "product_name_taken">
  >
> {
  return changeProduct(deps, input, async (product, at) =>
    (await nameTaken(deps.products, input.name, product.id))
      ? err("product_name_taken" as const)
      : ok(Products.rename(product, input.name, input.by, at)),
  );
}
