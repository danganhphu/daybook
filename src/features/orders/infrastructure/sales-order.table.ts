import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureTable } from "@/features/capture/infrastructure/capture.table";
import { customerTable } from "@/features/customers/infrastructure/customer.table";
import { orderLimits } from "@/features/orders/domain/order";
import {
  auditChecks,
  auditColumns,
  deletionChecks,
  deletionColumns,
} from "@/shared/infrastructure/d1/audit-columns";
import { isCalendarDay } from "@/shared/infrastructure/d1/calendar-day-column";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// `order` is a keyword in SQL. The total is never stored: it is the sum of the lines. capture_id is set only when a
// message became the order (ADR 0011, decision 5).
export const salesOrderTable = sqliteTable(
  "sales_order",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id),
    orderedOn: text("ordered_on").notNull(),
    deliveredOn: text("delivered_on"),
    note: text("note"),
    captureId: text("capture_id").references(() => captureTable.id),
    ...auditColumns(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
    // The customer it was deleted with; it comes back with them
    deletedWith: text("deleted_with").references(() => customerTable.id),
  },
  (table) => [
    check("sales_order_ordered_on_day", isCalendarDay(table.orderedOn)),
    check(
      "sales_order_delivered_on_day",
      sql`${table.deliveredOn} is null or (${isCalendarDay(table.deliveredOn)} and ${table.deliveredOn} >= ${table.orderedOn})`,
    ),
    check(
      "sales_order_note_length",
      sql`${table.note} is null or length(${table.note}) between 1 and ${sqlNumber(orderLimits.note)}`,
    ),
    ...auditChecks("sales_order", table),
    ...deletionChecks("sales_order", table),
    check(
      "sales_order_deleted_with_only_deleted",
      sql`${table.deletedWith} is null or ${table.deletedAt} is not null`,
    ),
    index("sales_order_live_by_day")
      .on(table.orderedOn)
      .where(sql`${table.deletedAt} is null`),
    index("sales_order_deleted_by_deleted_at")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    index("sales_order_by_customer").on(table.customerId),
  ],
);
