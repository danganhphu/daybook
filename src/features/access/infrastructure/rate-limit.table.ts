import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per key and fixed window; window_start is epoch milliseconds
export const rateLimitTable = sqliteTable(
  "rate_limit",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    hits: integer("hits").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    check("rate_limit_hits_positive", sql`${table.hits} > 0`),
  ],
);
