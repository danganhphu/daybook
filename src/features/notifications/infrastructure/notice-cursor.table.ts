import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// Where the relay of security notices has read the access log to: a single row
export const noticeCursorName = "access_notices";

export const noticeCursorTable = sqliteTable(
  "notice_cursor",
  {
    name: text("name").primaryKey(),
    occurredAt: integer("occurred_at").notNull(),
    eventId: text("event_id").notNull(),
  },
  (table) => [
    check("notice_cursor_single", sql`${table.name} in (${sqlTextList([noticeCursorName])})`),
  ],
);
