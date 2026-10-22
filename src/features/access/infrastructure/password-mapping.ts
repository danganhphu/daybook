import { Temporal } from "temporal-polyfill/implementation";

import { accountIdSchema } from "@/features/access/domain/account";
import {
  passwordSaltSchema,
  passwordVerifierSchema,
  type Password,
} from "@/features/access/domain/password";

import type { passwordTable } from "./password.table";

type PasswordRow = typeof passwordTable.$inferSelect;

export function toPassword(row: PasswordRow): Password {
  return {
    accountId: accountIdSchema.parse(row.accountId),
    salt: passwordSaltSchema.parse(row.salt),
    parameters: {
      memoryKib: row.argon2MemoryKib,
      iterations: row.argon2Iterations,
      parallelism: row.argon2Parallelism,
    },
    verifier: passwordVerifierSchema.parse(row.verifier),
    pepperVersion: row.pepperVersion,
    consecutiveFailures: row.consecutiveFailures,
    lockedAt:
      row.lockedAt === null ? undefined : Temporal.Instant.fromEpochMilliseconds(row.lockedAt),
    changedAt: Temporal.Instant.fromEpochMilliseconds(row.changedAt),
  };
}

export function toPasswordRow(password: Password): PasswordRow {
  return {
    accountId: password.accountId,
    salt: password.salt,
    argon2MemoryKib: password.parameters.memoryKib,
    argon2Iterations: password.parameters.iterations,
    argon2Parallelism: password.parameters.parallelism,
    verifier: password.verifier,
    pepperVersion: password.pepperVersion,
    consecutiveFailures: password.consecutiveFailures,
    lockedAt: password.lockedAt?.epochMilliseconds ?? null,
    changedAt: password.changedAt.epochMilliseconds,
  };
}
