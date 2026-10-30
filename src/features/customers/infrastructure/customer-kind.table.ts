import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { kindNameMaxLength } from "@/features/customers/domain/customer-limits";
import {
  archivalChecks,
  archivalColumns,
  auditChecks,
  auditColumns,
  deletedOnlyArchivedChecks,
  deletionChecks,
  deletionColumns,
} from "@/shared/infrastructure/d1/audit-columns";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// The owner's own kinds of customer. search_name is the name as searches match it, and two active kinds never share one.
export const customerKindTable = sqliteTable(
  "customer_kind",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    searchName: text("search_name").notNull(),
    position: integer("position").notNull(),
    ...auditColumns(() => accountTable.id),
    ...archivalColumns(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
  },
  (table) => [
    check(
      "customer_kind_name_present",
      sql`length(trim(${table.name})) between 1 and ${sqlNumber(kindNameMaxLength)}`,
    ),
    check("customer_kind_position_positive", sql`${table.position} >= 0`),
    ...auditChecks("customer_kind", table),
    ...archivalChecks("customer_kind", table),
    ...deletionChecks("customer_kind", table),
    ...deletedOnlyArchivedChecks("customer_kind", table),
    uniqueIndex("customer_kind_active_name")
      .on(table.searchName)
      .where(sql`${table.archivedAt} is null`),
    index("customer_kind_by_position").on(table.position),
  ],
);
