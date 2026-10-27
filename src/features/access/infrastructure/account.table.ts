import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { secretByteLength } from "@/features/access/domain/access-policy";
import { displayNameMaxLength, usernameLength } from "@/features/access/domain/account-limits";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// Usernames arrive lower-cased, so the unique index already treats "Lan" and "lan" as one. Times are epoch ms.
export const accountTable = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    webauthnUserHandle: text("webauthn_user_handle").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check(
      "account_username_format",
      sql`length(${table.username}) between ${sqlNumber(usernameLength.minimum)} and ${sqlNumber(usernameLength.maximum)} and ${table.username} not glob '*[^a-z0-9._-]*'`,
    ),
    check(
      "account_display_name_present",
      sql`length(trim(${table.displayName})) between 1 and ${sqlNumber(displayNameMaxLength)}`,
    ),
    check(
      "account_user_handle_length",
      sql`length(${table.webauthnUserHandle}) = ${sqlNumber(base64UrlLength(secretByteLength))}`,
    ),
  ],
);
