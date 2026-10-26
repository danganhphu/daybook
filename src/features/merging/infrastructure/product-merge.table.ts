import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { productTable } from "@/features/products/infrastructure/product.table";

// One product merged into another: who, when, and the ids of the orders that moved, as JSON. Append-only: two
// triggers refuse any update or delete, as on `order_change`.
export const productMergeTable = sqliteTable(
  "product_merge",
  {
    id: text("id").primaryKey(),
    fromId: text("from_id")
      .notNull()
      .references(() => productTable.id),
    intoId: text("into_id")
      .notNull()
      .references(() => productTable.id),
    moved: text("moved").notNull(),
    mergedAt: integer("merged_at").notNull(),
    mergedBy: text("merged_by")
      .notNull()
      .references(() => accountTable.id),
  },
  (table) => [
    check("product_merge_not_itself", sql`${table.fromId} <> ${table.intoId}`),
    check("product_merge_moved_json", sql`json_valid(${table.moved})`),
    index("product_merge_by_into").on(table.intoId),
  ],
);
