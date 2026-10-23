import type { SearchTerm } from "@/shared/domain/search-text";

import type { Product, ProductId } from "./product";

// Reads only; writes go through the unit of work
export type ProductRepository = {
  getMany(ids: ReadonlyArray<ProductId>): Promise<ReadonlyArray<Product>>;
  // Active products whose name matches one of these, ignoring case and diacritics
  findActiveNamed(names: ReadonlyArray<string>): Promise<ReadonlyArray<Product>>;
  // Active products holding every word, by name, at most `limit`
  search(term: SearchTerm, limit: number): Promise<ReadonlyArray<Product>>;
};
