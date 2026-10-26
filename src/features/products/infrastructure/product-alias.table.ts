import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { productNameMaxLength } from "@/features/products/domain/product";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { productTable } from "./product.table";

// Another name a product is known by, matched as its own name is. A name means one product, so search names are
// unique across every alias. Removed outright: nothing points at an alias, and a merge keeps its own record.
export const productAliasTable = sqliteTable(
  "product_alias",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => productTable.id),
    name: text("name").notNull(),
    searchName: text("search_name").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => accountTable.id),
  },
  (table) => [
    check(
      "product_alias_name_present",
      sql`length(trim(${table.name})) between 1 and ${sqlNumber(productNameMaxLength)}`,
    ),
    uniqueIndex("product_alias_by_name").on(table.searchName),
    index("product_alias_by_product").on(table.productId),
  ],
);
