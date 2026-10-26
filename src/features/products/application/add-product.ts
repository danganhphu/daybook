import * as Products from "@/features/products/domain/product";
import type { ActiveProduct, ProductName } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import { nameTaken } from "./name-check";
import type { ProductDeps } from "./product-deps";
import type { ProductError } from "./product-errors";

export type AddProductInput = { readonly by: AccountId; readonly name: ProductName };

// From the products screen, before any order names it
export async function addProduct(
  deps: ProductDeps,
  input: AddProductInput,
): Promise<Result<ActiveProduct, Extract<ProductError, "product_name_taken">>> {
  if (await nameTaken(deps.products, input.name)) {
    return err("product_name_taken");
  }

  const product = Products.create(input.name, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.products.add([product]);
  await work.commit();

  return ok(product);
}
