import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { digestByteLength } from "@/features/access/domain/access-policy";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// code_hash is the SHA-256 of the code in the t.me link. Spent by deleting the row; an account's older codes go when
// it gets a new one. Times are epoch milliseconds.
export const telegramLinkCodeTable = sqliteTable(
  "telegram_link_code",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    codeHash: text("code_hash").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    check(
      "telegram_link_code_hash_length",
      sql`length(${table.codeHash}) = ${sqlNumber(base64UrlLength(digestByteLength))}`,
    ),
    check(
      "telegram_link_code_expires_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    index("telegram_link_code_by_account").on(table.accountId),
  ],
);
