import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { customerTable } from "@/features/customers/infrastructure/customer.table";

// One customer merged into another: who, when, and the ids of what moved, as JSON. Append-only: two triggers refuse
// any update or delete, as on `order_change`.
export const customerMergeTable = sqliteTable(
  "customer_merge",
  {
    id: text("id").primaryKey(),
    fromId: text("from_id")
      .notNull()
      .references(() => customerTable.id),
    intoId: text("into_id")
      .notNull()
      .references(() => customerTable.id),
    moved: text("moved").notNull(),
    mergedAt: integer("merged_at").notNull(),
    mergedBy: text("merged_by")
      .notNull()
      .references(() => accountTable.id),
  },
  (table) => [
    check("customer_merge_not_itself", sql`${table.fromId} <> ${table.intoId}`),
    check("customer_merge_moved_json", sql`json_valid(${table.moved})`),
    index("customer_merge_by_into").on(table.intoId),
  ],
);
