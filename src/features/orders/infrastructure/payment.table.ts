import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { orderLimits, paymentMethods } from "@/features/orders/domain/order";
import { moneyMax } from "@/shared/domain/money";
import { deletionChecks, deletionColumns } from "@/shared/infrastructure/d1/audit-columns";
import { isCalendarDay } from "@/shared/infrastructure/d1/calendar-day-column";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { salesOrderTable } from "./sales-order.table";

// Part of the order, under its version. Never edited: a trigger lets an update touch only the removal.
export const paymentTable = sqliteTable(
  "payment",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => salesOrderTable.id),
    amount: integer("amount").notNull(),
    paidOn: text("paid_on").notNull(),
    method: text("method"),
    note: text("note"),
    recordedAt: integer("recorded_at").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
  },
  (table) => [
    check("payment_amount_range", sql`${table.amount} between 1 and ${sqlNumber(moneyMax)}`),
    check("payment_paid_on_day", isCalendarDay(table.paidOn)),
    check(
      "payment_method_known",
      sql`${table.method} is null or ${table.method} in (${sqlTextList(paymentMethods)})`,
    ),
    check(
      "payment_note_length",
      sql`${table.note} is null or length(${table.note}) between 1 and ${sqlNumber(orderLimits.note)}`,
    ),
    ...deletionChecks("payment", table),
    index("payment_by_order").on(table.orderId),
  ],
);
