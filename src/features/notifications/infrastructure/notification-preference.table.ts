import { sql, type SQL } from "drizzle-orm";
import { check, sqliteTable, text, type SQLiteColumn } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { auditChecks, auditColumns } from "@/shared/infrastructure/d1/audit-columns";
import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// A quarter hour as HH:MM, or null for off: the same times the settings screen offers (time-of-day.ts)
function quarterHour(column: SQLiteColumn): SQL {
  return sql`${column} is null or (${column} glob '[0-2][0-9]:[0-5][0-9]' and ${column} < '24:00' and substr(${column}, 4, 2) in (${sqlTextList(["00", "15", "30", "45"])}))`;
}

// One row per person who has changed a time; nobody else has a row and gets the defaults
export const notificationPreferenceTable = sqliteTable(
  "notification_preference",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accountTable.id),
    morningAt: text("morning_at"),
    weeklyAt: text("weekly_at"),
    ...auditColumns(() => accountTable.id),
  },
  (table) => [
    check("notification_preference_morning_quarter_hour", quarterHour(table.morningAt)),
    check("notification_preference_weekly_quarter_hour", quarterHour(table.weeklyAt)),
    ...auditChecks("notification_preference", table),
  ],
);
