import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { customerLimits } from "@/features/customers/domain/customer-limits";
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

import { customerKindTable } from "./customer-kind.table";

// Optional details are null when not given, never "". search_name is the name and the area as searches match them,
// and orders lists by it, so "Ánh" sorts beside "Anh" rather than after "Z". A customer merged into another is
// hidden and names it; the migration's trigger refuses a merged one that is not hidden.
export const customerTable = sqliteTable(
  "customer",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    searchName: text("search_name").notNull(),
    kindId: text("kind_id").references(() => customerKindTable.id),
    area: text("area"),
    phone: text("phone"),
    address: text("address"),
    note: text("note"),
    mergedIntoId: text("merged_into_id").references((): AnySQLiteColumn => customerTable.id),
    ...auditColumns(() => accountTable.id),
    ...archivalColumns(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
  },
  (table) => [
    check(
      "customer_name_present",
      sql`length(trim(${table.name})) between 1 and ${sqlNumber(customerLimits.name)}`,
    ),
    check(
      "customer_details_length",
      sql`(${table.area} is null or length(${table.area}) between 1 and ${sqlNumber(customerLimits.area)})
        and (${table.phone} is null or length(${table.phone}) between 1 and ${sqlNumber(customerLimits.phone)})
        and (${table.address} is null or length(${table.address}) between 1 and ${sqlNumber(customerLimits.address)})
        and (${table.note} is null or length(${table.note}) between 1 and ${sqlNumber(customerLimits.note)})`,
    ),
    ...auditChecks("customer", table),
    ...archivalChecks("customer", table),
    ...deletionChecks("customer", table),
    ...deletedOnlyArchivedChecks("customer", table),
    index("customer_active_by_name")
      .on(table.searchName)
      .where(sql`${table.archivedAt} is null`),
    index("customer_by_kind").on(table.kindId),
  ],
);
