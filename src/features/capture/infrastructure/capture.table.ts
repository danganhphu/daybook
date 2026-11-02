import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureSources, sourceRefMaxLength } from "@/features/capture/domain/capture";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// Append-only: the migration adds triggers that refuse UPDATE and DELETE. Times are epoch milliseconds.
export const captureTable = sqliteTable(
  "capture",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    source: text("source", { enum: captureSources }).notNull(),
    sourceRef: text("source_ref"),
    authorId: text("author_id")
      .notNull()
      .references(() => accountTable.id),
    receivedAt: integer("received_at").notNull(),
  },
  (table) => [
    check("capture_source_known", sql`${table.source} in (${sqlTextList(captureSources)})`),
    check("capture_content_present", sql`length(trim(${table.content})) > 0`),
    // A Telegram message always says which one it was; the web has nothing to say
    check(
      "capture_source_ref_by_source",
      sql`(${table.source} = 'telegram') = (${table.sourceRef} is not null)`,
    ),
    check(
      "capture_source_ref_length",
      sql`${table.sourceRef} is null or length(${table.sourceRef}) between 1 and ${sqlNumber(sourceRefMaxLength)}`,
    ),
    // The idempotency key: the same message twice is one capture. Nulls never clash.
    uniqueIndex("capture_source_ref_once").on(table.source, table.sourceRef),
  ],
);
