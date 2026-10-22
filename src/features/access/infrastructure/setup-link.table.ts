import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { digestByteLength } from "@/features/access/domain/access-policy";
import { setupLinkPurposes } from "@/features/access/domain/setup-link";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// token_hash is the SHA-256 of the token in the link's fragment. The migration adds a trigger that lets a link be
// redeemed once. Times are epoch milliseconds.
export const setupLinkTable = sqliteTable(
  "setup_link",
  {
    id: text("id").primaryKey(),
    purpose: text("purpose", { enum: setupLinkPurposes }).notNull(),
    accountId: text("account_id").references(() => accountTable.id),
    createdBy: text("created_by").references(() => accountTable.id),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    redeemedAt: integer("redeemed_at"),
  },
  (table) => [
    check("setup_link_purpose_known", sql`${table.purpose} in (${sqlTextList(setupLinkPurposes)})`),
    check(
      "setup_link_token_hash_length",
      sql`length(${table.tokenHash}) = ${sqlNumber(base64UrlLength(digestByteLength))}`,
    ),
    // An invite names its account only once redeemed; every other link names it from the start
    check(
      "setup_link_account_by_purpose",
      sql`(${table.purpose} = 'invite' and (${table.accountId} is null or ${table.redeemedAt} is not null)) or (${table.purpose} <> 'invite' and ${table.accountId} is not null)`,
    ),
    // Only the operator's command makes a first-setup link; only a signed-in user makes an invite
    check(
      "setup_link_author_by_purpose",
      sql`(${table.purpose} <> 'first_setup' or ${table.createdBy} is null) and (${table.purpose} <> 'invite' or ${table.createdBy} is not null)`,
    ),
    check("setup_link_expires_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);
