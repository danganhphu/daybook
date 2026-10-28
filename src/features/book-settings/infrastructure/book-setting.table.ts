import { sql } from "drizzle-orm";
import { check, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { quietAfterDaysLimits } from "@/features/reports/domain/gone-quiet";
import { auditChecks, auditColumns } from "@/shared/infrastructure/d1/audit-columns";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// The book's one row, written the first time someone changes a setting; until then the defaults hold
export const bookSettingId = 1;

export const bookSettingTable = sqliteTable(
  "book_setting",
  {
    id: integer("id").primaryKey(),
    quietAfterDays: integer("quiet_after_days").notNull(),
    ...auditColumns(() => accountTable.id),
  },
  (table) => [
    check("book_setting_single", sql`${table.id} = ${sqlNumber(bookSettingId)}`),
    check(
      "book_setting_quiet_after_days_range",
      sql`${table.quietAfterDays} between ${sqlNumber(quietAfterDaysLimits.min)} and ${sqlNumber(quietAfterDaysLimits.max)}`,
    ),
    ...auditChecks("book_setting", table),
  ],
);
