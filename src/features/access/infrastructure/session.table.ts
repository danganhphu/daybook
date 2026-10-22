import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { digestByteLength } from "@/features/access/domain/access-policy";
import { authenticationMethods, deviceLabelMaxLength } from "@/features/access/domain/session";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";
import { passkeyTable } from "./passkey.table";

// verifier is the SHA-256 of the cookie's secret, base64url; the secret itself is never stored. Times are epoch ms.
export const sessionTable = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    verifier: text("verifier").notNull(),
    method: text("method", { enum: authenticationMethods }).notNull(),
    passkeyId: text("passkey_id").references(() => passkeyTable.id, { onDelete: "set null" }),
    authenticatedAt: integer("authenticated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    deviceLabel: text("device_label").notNull(),
  },
  (table) => [
    check("session_method_known", sql`${table.method} in (${sqlTextList(authenticationMethods)})`),
    check(
      "session_verifier_length",
      sql`length(${table.verifier}) = ${sqlNumber(base64UrlLength(digestByteLength))}`,
    ),
    check(
      "session_password_names_no_passkey",
      sql`${table.method} = 'passkey' or ${table.passkeyId} is null`,
    ),
    check("session_ends_after_it_starts", sql`${table.expiresAt} > ${table.authenticatedAt}`),
    check(
      "session_device_label_present",
      sql`length(trim(${table.deviceLabel})) between 1 and ${sqlNumber(deviceLabelMaxLength)}`,
    ),
    index("session_by_account").on(table.accountId),
  ],
);
