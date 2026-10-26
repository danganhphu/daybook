import type { Product } from "@/features/products/domain/product";
import type {
  ProductFilter,
  ProductRepository,
} from "@/features/products/domain/product-repository";

// What two people sell fits on one screen; past this, the search narrows it
export const productsListLimit = 200;

export type ProductsFound = {
  // By name
  readonly products: ReadonlyArray<Product>;
  readonly more: boolean;
};

export async function listProducts(
  deps: { readonly products: ProductRepository },
  filter: ProductFilter,
): Promise<ProductsFound> {
  const found = await deps.products.list(filter, productsListLimit + 1);

  return {
    products: found.slice(0, productsListLimit),
    more: found.length > productsListLimit,
  };
}
