import { sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

// A business day is stored as YYYY-MM-DD text (ADR 0011, decision 6): it sorts as text, and a month is a prefix.
// The CHECK holds the shape; whether the day exists is the domain's to say.
export function isCalendarDay(column: SQLiteColumn): SQL {
  return sql`${column} glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`;
}
