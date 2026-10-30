import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureTable } from "@/features/capture/infrastructure/capture.table";
import { customerTable } from "@/features/customers/infrastructure/customer.table";
import { contentMaxLength } from "@/shared/domain/content";
import {
  auditChecks,
  auditColumns,
  deletionChecks,
  deletionColumns,
} from "@/shared/infrastructure/d1/audit-columns";
import { isCalendarDay } from "@/shared/infrastructure/d1/calendar-day-column";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// Open while done_at and deleted_at are both null
export const reminderTable = sqliteTable(
  "reminder",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id").references(() => captureTable.id),
    text: text("text").notNull(),
    dueOn: text("due_on").notNull(),
    customerId: text("customer_id").references(() => customerTable.id),
    doneAt: integer("done_at"),
    doneBy: text("done_by").references(() => accountTable.id),
    ...auditColumns(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
    // The customer it was deleted with; it comes back with them
    deletedWith: text("deleted_with").references(() => customerTable.id),
  },
  (table) => [
    check(
      "reminder_text_present",
      sql`length(trim(${table.text})) > 0 and length(${table.text}) <= ${sqlNumber(contentMaxLength)}`,
    ),
    check("reminder_due_on_day", isCalendarDay(table.dueOn)),
    check("reminder_completion_whole", sql`(${table.doneAt} is null) = (${table.doneBy} is null)`),
    ...auditChecks("reminder", table),
    ...deletionChecks("reminder", table),
    check(
      "reminder_deleted_with_only_deleted",
      sql`${table.deletedWith} is null or ${table.deletedAt} is not null`,
    ),
    index("reminder_open_by_due_on")
      .on(table.dueOn)
      .where(sql`${table.doneAt} is null and ${table.deletedAt} is null`),
    // The finished ones, newest first, paged by (done_at, id)
    index("reminder_done_by_done_at")
      .on(table.doneAt, table.id)
      .where(sql`${table.doneAt} is not null and ${table.deletedAt} is null`),
    index("reminder_deleted_by_deleted_at")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    index("reminder_by_customer").on(table.customerId),
  ],
);
