import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureSources } from "@/features/capture/domain/capture";
import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// Append-only: the migration adds triggers that refuse UPDATE and DELETE. Times are epoch milliseconds.
export const captureTable = sqliteTable(
  "capture",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    source: text("source", { enum: captureSources }).notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => accountTable.id),
    receivedAt: integer("received_at").notNull(),
  },
  (table) => [
    check("capture_source_known", sql`${table.source} in (${sqlTextList(captureSources)})`),
    check("capture_content_present", sql`length(trim(${table.content})) > 0`),
  ],
);
