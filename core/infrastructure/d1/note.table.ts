import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { captureTable } from "./capture.table";

// A note is live while deleted_at is null; deleting only sets it, so Undo is an update. Times are epoch milliseconds.
export const noteTable = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id")
      .notNull()
      .references(() => captureTable.id),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (table) => [
    check("note_content_present", sql`length(trim(${table.content})) > 0`),
    index("note_live_by_created_at")
      .on(table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("note_by_capture").on(table.captureId),
  ],
);
