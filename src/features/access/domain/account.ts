import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { accountIdSchema, type AccountId } from "@/shared/domain/account-id";

import { displayNameMaxLength, usernameLength, usernameRule } from "./account-limits";
import { randomValueSchema } from "./secret";

// Read as a module: `import * as Accounts` then `Accounts.create(...)`. The id lives in the shared kernel
// (`@/shared/domain/account-id`), since every feature records who acted.

// What someone types to sign in with the fallback password. Plain Latin so every keyboard types it the same way,
// lower-cased so "Lan" and "lan" are one name.
export const usernameSchema = z
  .string({ error: "Tên đăng nhập phải là chữ" })
  .trim()
  .toLowerCase()
  .regex(new RegExp(`^[a-z0-9._-]{${usernameLength.minimum},${usernameLength.maximum}}$`), {
    error: `Tên đăng nhập ${usernameRule}`,
  })
  .brand<"Username">();

export type Username = z.infer<typeof usernameSchema>;

// The name the app and the passkey manager show. NFC, so a name typed with Telex and with VNI is one string.
export const displayNameSchema = z
  .string({ error: "Tên phải là chữ" })
  .normalize("NFC")
  .trim()
  .min(1, { error: "Chưa nhập tên" })
  .max(displayNameMaxLength, { error: `Tên tối đa ${displayNameMaxLength} ký tự` })
  .brand<"DisplayName">();

export type DisplayName = z.infer<typeof displayNameSchema>;

// WebAuthn's user.id: random, so it carries nothing personal and is not the account id (WebAuthn L3, 5.4.3)
export const userHandleSchema = randomValueSchema.brand<"UserHandle">();

export type UserHandle = z.infer<typeof userHandleSchema>;

export type Account = {
  readonly id: AccountId;
  readonly username: Username;
  readonly displayName: DisplayName;
  readonly userHandle: UserHandle;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

export type NewAccount = {
  readonly username: Username;
  readonly displayName: DisplayName;
  readonly userHandle: UserHandle;
};

export function create(details: NewAccount, now: Temporal.Instant): Account {
  return { id: accountIdSchema.parse(uuidv7()), ...details, createdAt: now, updatedAt: now };
}

export function rename(account: Account, displayName: DisplayName, now: Temporal.Instant): Account {
  return { ...account, displayName, updatedAt: now };
}

// The user handle stays: passkeys know the account by it, so a new username needs no new passkey
export function changeUsername(
  account: Account,
  username: Username,
  now: Temporal.Instant,
): Account {
  return { ...account, username, updatedAt: now };
}
