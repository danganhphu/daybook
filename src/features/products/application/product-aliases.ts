import type { ProductId, ProductName } from "@/features/products/domain/product";
import * as ProductAliases from "@/features/products/domain/product-alias";
import type { ProductAlias, ProductAliasId } from "@/features/products/domain/product-alias";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import { nameTaken } from "./name-check";
import type { ProductDeps } from "./product-deps";
import type { ProductError } from "./product-errors";

export type AddProductAliasInput = {
  readonly by: AccountId;
  readonly productId: ProductId;
  readonly name: ProductName;
};

// Another name for a shown product. Refused when it already means a product - this one included - or is another
// product's other name, even a hidden one's: one name, one product.
export async function addProductAlias(
  deps: ProductDeps,
  input: AddProductAliasInput,
): Promise<
  Result<
    ProductAlias,
    Extract<ProductError, "product_not_found" | "product_archived" | "alias_taken">
  >
> {
  const product = await deps.products.get(input.productId);
  if (product === undefined) {
    return err("product_not_found");
  }
  if (product.status === "archived") {
    return err("product_archived");
  }
  if (
    (await nameTaken(deps.products, input.name)) ||
    (await deps.products.findAliasNamed(input.name)) !== undefined
  ) {
    return err("alias_taken");
  }

  const alias = ProductAliases.create(product.id, input.name, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.productAliases.add([alias]);
  await work.commit();

  return ok(alias);
}

// Removed outright: nothing points at a name, and who removed it is not worth a record of its own
export async function removeProductAlias(
  deps: ProductDeps,
  aliasId: ProductAliasId,
): Promise<Result<ProductAlias, Extract<ProductError, "alias_not_found">>> {
  const alias = await deps.products.getAlias(aliasId);
  if (alias === undefined) {
    return err("alias_not_found");
  }

  const work = deps.startUnitOfWork();
  work.productAliases.remove([alias.id]);
  await work.commit();

  return ok(alias);
}
