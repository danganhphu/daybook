import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureTable } from "@/features/capture/infrastructure/capture.table";
import {
  auditChecks,
  auditColumns,
  deletionChecks,
  deletionColumns,
} from "@/shared/infrastructure/d1/audit-columns";

// A note is live while deleted_at is null; deleting only sets it, so Undo is an update. Times are epoch milliseconds.
// search_text is the content as searches match it (searchText), written with every change of the content.
export const noteTable = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id")
      .notNull()
      .references(() => captureTable.id),
    content: text("content").notNull(),
    searchText: text("search_text").notNull(),
    ...auditColumns(() => accountTable.id),
    ...deletionColumns(() => accountTable.id),
  },
  (table) => [
    check("note_content_present", sql`length(trim(${table.content})) > 0`),
    ...auditChecks("note", table),
    ...deletionChecks("note", table),
    index("note_live_by_created_at")
      .on(table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    index("note_deleted_by_deleted_at")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`),
    index("note_by_capture").on(table.captureId),
  ],
);
