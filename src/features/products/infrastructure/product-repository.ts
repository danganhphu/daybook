import { and, asc, inArray, isNull } from "drizzle-orm";

import type { ProductRepository } from "@/features/products/domain/product-repository";
import { searchText } from "@/shared/domain/search-text";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";

import { toProduct } from "./product-mapping";
import { productTable } from "./product.table";

export function createProductRepository(db: Database): ProductRepository {
  return {
    async getMany(ids) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(productTable)
        .where(inArray(productTable.id, [...ids]));

      return rows.map(toProduct);
    },

    async findActiveNamed(names) {
      if (names.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(productTable)
        .where(
          and(
            inArray(productTable.searchName, names.map(searchText)),
            isNull(productTable.archivedAt),
          ),
        );

      return rows.map(toProduct);
    },

    async search(term, limit) {
      const rows = await db
        .select()
        .from(productTable)
        .where(
          and(
            isNull(productTable.archivedAt),
            ...term.split(" ").map((word) => containsLiterally(productTable.searchName, word)),
          ),
        )
        .orderBy(asc(productTable.searchName))
        .limit(limit);

      return rows.map(toProduct);
    },
  };
}
