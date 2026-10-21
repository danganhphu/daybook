import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
      sql`length(${table.username}) between 3 and 32 and ${table.username} not glob '*[^a-z0-9._-]*'`,
    ),
    check("account_display_name_present", sql`length(trim(${table.displayName})) between 1 and 60`),
    check("account_user_handle_length", sql`length(${table.webauthnUserHandle}) = 43`),
  ],
);
