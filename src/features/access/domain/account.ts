import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { randomValueSchema } from "./secret";

// Read as a module: `import * as Accounts` then `Accounts.create(...)`

export const accountIdSchema = z.uuid().brand<"AccountId">();

export type AccountId = z.infer<typeof accountIdSchema>;

// What someone types to sign in with the fallback password. Plain Latin so every keyboard types it the same way,
// lower-cased so "Lan" and "lan" are one name.
export const usernameSchema = z
  .string({ error: "Tên đăng nhập phải là chữ" })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, {
    error: "Tên đăng nhập dài 3-32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang",
  })
  .brand<"Username">();

export type Username = z.infer<typeof usernameSchema>;

// The name the app and the passkey manager show. NFC, so a name typed with Telex and with VNI is one string.
export const displayNameSchema = z
  .string({ error: "Tên hiển thị phải là chữ" })
  .normalize("NFC")
  .trim()
  .min(1, { error: "Chưa có tên hiển thị" })
  .max(60, { error: "Tên hiển thị tối đa 60 ký tự" })
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
