import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { customerLimits } from "@/features/customers/domain/customer-limits";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { customerTable } from "./customer.table";

// Another name a customer is known by: "chị Lan" for Nha khoa Lan Anh. Two customers may share a name, so an alias is
// unique only within its customer. Removed outright: nothing points at an alias, and a merge keeps its own record.
export const customerAliasTable = sqliteTable(
  "customer_alias",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id),
    name: text("name").notNull(),
    searchName: text("search_name").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => accountTable.id),
  },
  (table) => [
    check(
      "customer_alias_name_present",
      sql`length(trim(${table.name})) between 1 and ${sqlNumber(customerLimits.name)}`,
    ),
    uniqueIndex("customer_alias_per_customer").on(table.customerId, table.searchName),
    index("customer_alias_by_name").on(table.searchName),
  ],
);
