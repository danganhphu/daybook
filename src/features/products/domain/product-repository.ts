import type { SearchTerm } from "@/shared/domain/search-text";

import type { Product, ProductId } from "./product";
import type { ProductAlias, ProductAliasId } from "./product-alias";

export type ProductFilter = {
  // Every word in the name, or every word in one of the other names
  readonly search?: SearchTerm | undefined;
  readonly status: "active" | "archived";
};

// Reads only; writes go through the unit of work
export type ProductRepository = {
  get(id: ProductId): Promise<Product | undefined>;
  getMany(ids: ReadonlyArray<ProductId>): Promise<ReadonlyArray<Product>>;
  // The active product each name means, by its own name or another it is known by, ignoring case and diacritics;
  // keyed by the name's search text
  findActiveNamed(names: ReadonlyArray<string>): Promise<ReadonlyMap<string, Product>>;
  // Active products holding every word, by name, at most `limit`
  search(term: SearchTerm, limit: number): Promise<ReadonlyArray<Product>>;
  // By name, at most `limit`
  list(filter: ProductFilter, limit: number): Promise<ReadonlyArray<Product>>;
  // Oldest first
  aliasesOf(id: ProductId): Promise<ReadonlyArray<ProductAlias>>;
  getAlias(id: ProductAliasId): Promise<ProductAlias | undefined>;
  // Any product's other name, hidden products' included: no two share one
  findAliasNamed(name: string): Promise<ProductAlias | undefined>;
};
