import type { Temporal } from "temporal-polyfill/implementation";

import * as Accounts from "@/features/access/domain/account";
import {
  userHandleSchema,
  type Account,
  type DisplayName,
  type Username,
} from "@/features/access/domain/account";

import { newRandomValue } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type NewAccountDetails = {
  readonly username: Username;
  readonly displayName: DisplayName;
};

// An account with a fresh WebAuthn user handle: random, so passkey managers learn nothing from it
export function newAccount(
  secrets: Secrets,
  details: NewAccountDetails,
  now: Temporal.Instant,
): Account {
  return Accounts.create(
    { ...details, userHandle: userHandleSchema.parse(newRandomValue(secrets)) },
    now,
  );
}
