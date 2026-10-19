import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { captureSources } from "@/features/capture/domain/capture";

const sourceList = sql.raw(captureSources.map((source) => `'${source}'`).join(", "));

// Append-only: the migration adds triggers that refuse UPDATE and DELETE. Times are epoch milliseconds.
export const captureTable = sqliteTable(
  "capture",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    source: text("source", { enum: captureSources }).notNull(),
    receivedAt: integer("received_at").notNull(),
  },
  (table) => [
    check("capture_source_known", sql`${table.source} in (${sourceList})`),
    check("capture_content_present", sql`length(trim(${table.content})) > 0`),
  ],
);
