import type { ActiveProduct, Product } from "@/features/products/domain/product";
import type { ProductAlias, ProductAliasId } from "@/features/products/domain/product-alias";

// Queues product changes on the current unit of work. New products go in as few statements as D1 allows, beside the
// order that names them: an order of fifty new things must not cost fifty queries.
export type ProductWrites = {
  add(products: ReadonlyArray<ActiveProduct>): void;
  update(product: Product): void;
};

// A name moving to another product is removed before it is added again, in the same batch: no two hold one name
export type ProductAliasWrites = {
  add(aliases: ReadonlyArray<ProductAlias>): void;
  remove(ids: ReadonlyArray<ProductAliasId>): void;
};
