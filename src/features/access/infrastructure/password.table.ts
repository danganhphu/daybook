import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  argon2Minimum,
  digestByteLength,
  passwordSaltByteLength,
} from "@/features/access/domain/access-policy";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// At most one fallback password per account. Salt and verifier are base64url; the Argon2id cost is kept per row so
// it can be raised later without a migration, and never below OWASP's minimum. Times are epoch ms.
export const passwordTable = sqliteTable(
  "password",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accountTable.id),
    salt: text("salt").notNull(),
    argon2MemoryKib: integer("argon2_memory_kib").notNull(),
    argon2Iterations: integer("argon2_iterations").notNull(),
    argon2Parallelism: integer("argon2_parallelism").notNull(),
    verifier: text("verifier").notNull(),
    pepperVersion: integer("pepper_version").notNull(),
    consecutiveFailures: integer("consecutive_failures").notNull(),
    lockedAt: integer("locked_at"),
    changedAt: integer("changed_at").notNull(),
  },
  (table) => [
    check(
      "password_salt_length",
      sql`length(${table.salt}) = ${sqlNumber(base64UrlLength(passwordSaltByteLength))}`,
    ),
    check(
      "password_verifier_length",
      sql`length(${table.verifier}) = ${sqlNumber(base64UrlLength(digestByteLength))}`,
    ),
    check(
      "password_argon2_at_least_owasp",
      sql`${table.argon2MemoryKib} >= ${sqlNumber(argon2Minimum.memoryKib)} and ${table.argon2Iterations} >= ${sqlNumber(argon2Minimum.iterations)} and ${table.argon2Parallelism} >= ${sqlNumber(argon2Minimum.parallelism)}`,
    ),
    check("password_pepper_version_positive", sql`${table.pepperVersion} >= 1`),
    check("password_failures_not_negative", sql`${table.consecutiveFailures} >= 0`),
  ],
);
