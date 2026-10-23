import type { Temporal } from "temporal-polyfill/implementation";
import type { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import { base64UrlSchema } from "@/shared/domain/base64url-schema";

import {
  argon2Parameters,
  derivedKeyByteLength,
  digestByteLength,
  passwordLockAfter,
  passwordSaltByteLength,
} from "./access-policy";

// Read as a module: `import * as Passwords` then `Passwords.set(...)`

export const passwordSaltSchema = base64UrlSchema(passwordSaltByteLength).brand<"PasswordSalt">();

export type PasswordSalt = z.infer<typeof passwordSaltSchema>;

// What the browser derives from the password with Argon2id. It is the secret the server sees; never stored.
export const derivedKeySchema = base64UrlSchema(derivedKeyByteLength).brand<"DerivedKey">();

export type DerivedKey = z.infer<typeof derivedKeySchema>;

// HMAC-SHA256 of the derived key under the pepper. A database leak alone gives nothing to test guesses against.
export const passwordVerifierSchema = base64UrlSchema(digestByteLength).brand<"PasswordVerifier">();

export type PasswordVerifier = z.infer<typeof passwordVerifierSchema>;

export type Argon2Parameters = {
  readonly memoryKib: number;
  readonly iterations: number;
  readonly parallelism: number;
};

export const currentArgon2Parameters: Argon2Parameters = argon2Parameters;

// The fallback way in for one account. At most one per account.
export type Password = {
  readonly accountId: AccountId;
  readonly salt: PasswordSalt;
  readonly parameters: Argon2Parameters;
  readonly verifier: PasswordVerifier;
  // Which pepper made the verifier, so the pepper can be rotated
  readonly pepperVersion: number;
  readonly consecutiveFailures: number;
  readonly lockedAt: Temporal.Instant | undefined;
  readonly changedAt: Temporal.Instant;
};

export type NewPassword = Pick<
  Password,
  "accountId" | "salt" | "parameters" | "verifier" | "pepperVersion"
>;

// A new or changed password starts with a clean slate: no failures, not locked
export function set(details: NewPassword, now: Temporal.Instant): Password {
  return { ...details, consecutiveFailures: 0, lockedAt: undefined, changedAt: now };
}

export function isLocked(password: Password): boolean {
  return password.lockedAt !== undefined;
}

// One more wrong guess. The hundredth in a row locks it until it is changed (NIST 800-63B-4, 3.2.2).
export function recordFailure(password: Password, now: Temporal.Instant): Password {
  const consecutiveFailures = password.consecutiveFailures + 1;

  return {
    ...password,
    consecutiveFailures,
    lockedAt: password.lockedAt ?? (consecutiveFailures >= passwordLockAfter ? now : undefined),
  };
}

export function recordSuccess(password: Password): Password {
  return { ...password, consecutiveFailures: 0 };
}
