import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  digestByteLength,
  passwordSaltByteLength,
  secretByteLength,
} from "@/features/access/domain/access-policy";
import { ceremonyKinds } from "@/features/access/domain/ceremony";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";
import { setupLinkTable } from "./setup-link.table";

// binding_hash is the SHA-256 of the cookie that ties a ceremony to one browser. Rows are deleted when used.
export const ceremonyTable = sqliteTable(
  "ceremony",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ceremonyKinds }).notNull(),
    bindingHash: text("binding_hash").notNull(),
    accountId: text("account_id").references(() => accountTable.id),
    setupLinkId: text("setup_link_id").references(() => setupLinkTable.id),
    // The passkey prompt being waited on; cleared the moment a response to it arrives
    challenge: text("challenge"),
    // The salt handed out for a new password, until the key derived from it arrives
    salt: text("salt"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    check("ceremony_kind_known", sql`${table.kind} in (${sqlTextList(ceremonyKinds)})`),
    check(
      "ceremony_binding_hash_length",
      sql`length(${table.bindingHash}) = ${sqlNumber(base64UrlLength(digestByteLength))}`,
    ),
    check(
      "ceremony_challenge_length",
      sql`${table.challenge} is null or length(${table.challenge}) = ${sqlNumber(base64UrlLength(secretByteLength))}`,
    ),
    check(
      "ceremony_salt_length",
      sql`${table.salt} is null or length(${table.salt}) = ${sqlNumber(base64UrlLength(passwordSaltByteLength))}`,
    ),
    check(
      "ceremony_setup_names_its_link",
      sql`${table.kind} <> 'setup' or ${table.setupLinkId} is not null`,
    ),
    check("ceremony_expires_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);
