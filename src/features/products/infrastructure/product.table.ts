import { sql } from "drizzle-orm";
import {
  check,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { productNameMaxLength } from "@/features/products/domain/product";
import {
  archivalChecks,
  archivalColumns,
  auditChecks,
  auditColumns,
} from "@/shared/infrastructure/d1/audit-columns";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// "thuốc tê", "Thuốc Tê" and "thuoc te" are one product: two active products never share a search name. A product
// merged into another is hidden and names it; the migration's trigger refuses a merged one that is not hidden.
export const productTable = sqliteTable(
  "product",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    searchName: text("search_name").notNull(),
    mergedIntoId: text("merged_into_id").references((): AnySQLiteColumn => productTable.id),
    ...auditColumns(() => accountTable.id),
    ...archivalColumns(() => accountTable.id),
  },
  (table) => [
    check(
      "product_name_present",
      sql`length(trim(${table.name})) between 1 and ${sqlNumber(productNameMaxLength)}`,
    ),
    ...auditChecks("product", table),
    ...archivalChecks("product", table),
    uniqueIndex("product_active_name")
      .on(table.searchName)
      .where(sql`${table.archivedAt} is null`),
  ],
);
