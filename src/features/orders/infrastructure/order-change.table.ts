import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { orderChangeKinds } from "@/features/orders/domain/order-change";
import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { salesOrderTable } from "./sales-order.table";

// Append-only: two triggers refuse any update or delete, as on `capture`. before and after are the order as JSON.
export const orderChangeTable = sqliteTable(
  "order_change",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => salesOrderTable.id),
    kind: text("kind").notNull(),
    changedAt: integer("changed_at").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => accountTable.id),
    before: text("before"),
    after: text("after").notNull(),
  },
  (table) => [
    check("order_change_kind_known", sql`${table.kind} in (${sqlTextList(orderChangeKinds)})`),
    check(
      "order_change_json",
      sql`json_valid(${table.after}) and (${table.before} is null or json_valid(${table.before}))`,
    ),
    index("order_change_by_order").on(table.orderId, table.changedAt),
  ],
);
