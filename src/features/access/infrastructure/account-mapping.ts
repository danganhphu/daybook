import { Temporal } from "temporal-polyfill/implementation";

import {
  accountIdSchema,
  displayNameSchema,
  userHandleSchema,
  usernameSchema,
  type Account,
} from "@/features/access/domain/account";

import type { accountTable } from "./account.table";

type AccountRow = typeof accountTable.$inferSelect;

export function toAccount(row: AccountRow): Account {
  return {
    id: accountIdSchema.parse(row.id),
    username: usernameSchema.parse(row.username),
    displayName: displayNameSchema.parse(row.displayName),
    userHandle: userHandleSchema.parse(row.webauthnUserHandle),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updatedAt),
  };
}

export function toAccountRow(account: Account): AccountRow {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    webauthnUserHandle: account.userHandle,
    createdAt: account.createdAt.epochMilliseconds,
    updatedAt: account.updatedAt.epochMilliseconds,
  };
}
