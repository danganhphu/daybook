import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { ceremonyKinds } from "@/features/access/domain/ceremony";

import { accountTable } from "./account.table";
import { setupLinkTable } from "./setup-link.table";

const kindList = sql.raw(ceremonyKinds.map((kind) => `'${kind}'`).join(", "));

// binding_hash is the SHA-256 of the cookie that ties a ceremony to one browser. Rows are deleted when used.
export const ceremonyTable = sqliteTable(
  "ceremony",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ceremonyKinds }).notNull(),
    bindingHash: text("binding_hash").notNull(),
    accountId: text("account_id").references(() => accountTable.id),
    setupLinkId: text("setup_link_id").references(() => setupLinkTable.id),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    check("ceremony_kind_known", sql`${table.kind} in (${kindList})`),
    check("ceremony_binding_hash_length", sql`length(${table.bindingHash}) = 43`),
    check(
      "ceremony_setup_names_its_link",
      sql`${table.kind} <> 'setup' or ${table.setupLinkId} is not null`,
    ),
    check("ceremony_expires_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);
