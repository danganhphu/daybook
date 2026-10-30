import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { ArchivedProduct, Product } from "@/features/products/domain/product";
import type {
  ProductFilter,
  ProductRepository,
} from "@/features/products/domain/product-repository";
import { searchText } from "@/shared/domain/search-text";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";

import { productAliasTable } from "./product-alias.table";
import { toProduct, toProductAlias } from "./product-mapping";
import { productTable } from "./product.table";

export function createProductRepository(db: Database): ProductRepository {
  async function list(filter: ProductFilter, limit: number) {
    const words = filter.search?.split(" ") ?? [];
    // Every word in the name, or every word in one other name of the same product
    const found =
      words.length === 0
        ? undefined
        : or(
            and(...words.map((word) => containsLiterally(productTable.searchName, word))),
            sql`exists (select 1 from ${productAliasTable} where ${productAliasTable.productId} = ${productTable.id} and ${and(...words.map((word) => containsLiterally(productAliasTable.searchName, word)))})`,
          );
    const rows = await db
      .select()
      .from(productTable)
      .where(
        and(
          filter.status === "active"
            ? isNull(productTable.archivedAt)
            : and(isNotNull(productTable.archivedAt), isNull(productTable.deletedAt)),
          found,
        ),
      )
      .orderBy(asc(productTable.searchName), asc(productTable.id))
      .limit(limit);

    return rows.map(toProduct);
  }

  return {
    async get(id) {
      const [row] = await db.select().from(productTable).where(eq(productTable.id, id)).limit(1);

      return row === undefined ? undefined : toProduct(row);
    },

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

    // Three reads of one table each, in one round trip: no join, since a batch maps result columns by name and the
    // two tables share several. A product's own name wins over another product's alias.
    async findActiveNamed(names) {
      const wanted = [...new Set(names.map(searchText))];
      if (wanted.length === 0) {
        return new Map();
      }
      const aliasesOfWanted = and(
        inArray(productAliasTable.searchName, wanted),
        inArray(
          productAliasTable.productId,
          db
            .select({ id: productTable.id })
            .from(productTable)
            .where(isNull(productTable.archivedAt)),
        ),
      );
      const [named, aliases, aliasedProducts] = await db.batch([
        db
          .select()
          .from(productTable)
          .where(and(inArray(productTable.searchName, wanted), isNull(productTable.archivedAt))),
        db
          .select({
            searchName: productAliasTable.searchName,
            productId: productAliasTable.productId,
          })
          .from(productAliasTable)
          .where(aliasesOfWanted),
        db
          .select()
          .from(productTable)
          .where(
            inArray(
              productTable.id,
              db
                .select({ id: productAliasTable.productId })
                .from(productAliasTable)
                .where(aliasesOfWanted),
            ),
          ),
      ]);

      const products = new Map(aliasedProducts.map((row) => [row.id, toProduct(row)]));
      const byName = new Map<string, Product>();
      for (const alias of aliases) {
        const product = products.get(alias.productId);
        if (product !== undefined) {
          byName.set(alias.searchName, product);
        }
      }
      for (const row of named) {
        byName.set(row.searchName, toProduct(row));
      }

      return byName;
    },

    search(term, limit) {
      return list({ search: term, status: "active" }, limit);
    },

    list,

    async listDeleted(since, limit) {
      const rows = await db
        .select()
        .from(productTable)
        .where(
          and(
            isNotNull(productTable.deletedAt),
            gte(productTable.deletedAt, since.epochMilliseconds),
          ),
        )
        .orderBy(desc(productTable.deletedAt), desc(productTable.id))
        .limit(limit);

      return rows
        .map(toProduct)
        .filter((product): product is ArchivedProduct => product.status === "archived");
    },

    async aliasesOf(id) {
      const rows = await db
        .select()
        .from(productAliasTable)
        .where(eq(productAliasTable.productId, id))
        .orderBy(asc(productAliasTable.createdAt), asc(productAliasTable.id));

      return rows.map(toProductAlias);
    },

    async getAlias(id) {
      const [row] = await db
        .select()
        .from(productAliasTable)
        .where(eq(productAliasTable.id, id))
        .limit(1);

      return row === undefined ? undefined : toProductAlias(row);
    },

    async findAliasNamed(name) {
      const [row] = await db
        .select()
        .from(productAliasTable)
        .where(eq(productAliasTable.searchName, searchText(name)))
        .limit(1);

      return row === undefined ? undefined : toProductAlias(row);
    },
  };
}
