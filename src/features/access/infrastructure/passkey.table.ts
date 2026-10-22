import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { passkeyAlgorithms } from "@/features/access/domain/passkey";
import { sqlNumberList } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// Filled from step 2 of the sign-in plan; here now because sessions name the passkey they came from.
// Binary values are base64url text; transports a JSON array.
export const passkeyTable = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    algorithm: integer("algorithm").notNull(),
    signCount: integer("sign_count").notNull(),
    transports: text("transports").notNull(),
    aaguid: text("aaguid").notNull(),
    backupEligible: integer("backup_eligible").notNull(),
    backedUp: integer("backed_up").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
  },
  (table) => [
    // What the registration options offer
    check(
      "passkey_algorithm_offered",
      sql`${table.algorithm} in (${sqlNumberList(passkeyAlgorithms)})`,
    ),
    check("passkey_sign_count_not_negative", sql`${table.signCount} >= 0`),
    check(
      "passkey_transports_array",
      sql`json_valid(${table.transports}) and json_type(${table.transports}) = 'array'`,
    ),
    check(
      "passkey_backup_flags",
      sql`${table.backupEligible} in (0, 1) and ${table.backedUp} in (0, 1)`,
    ),
    index("passkey_by_account").on(table.accountId),
  ],
);
