import { Temporal } from "temporal-polyfill/implementation";

import { accountIdSchema } from "@/features/access/domain/account";
import { secretHashSchema } from "@/features/access/domain/secret";
import {
  setupLinkIdSchema,
  type PendingSetupLink,
  type SetupLink,
} from "@/features/access/domain/setup-link";

import type { setupLinkTable } from "./setup-link.table";

type SetupLinkRow = typeof setupLinkTable.$inferSelect;

export function toSetupLink(row: SetupLinkRow): SetupLink {
  const fields = {
    id: setupLinkIdSchema.parse(row.id),
    purpose: row.purpose,
    accountId: row.accountId === null ? undefined : accountIdSchema.parse(row.accountId),
    createdBy: row.createdBy === null ? undefined : accountIdSchema.parse(row.createdBy),
    tokenHash: secretHashSchema.parse(row.tokenHash),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    expiresAt: Temporal.Instant.fromEpochMilliseconds(row.expiresAt),
  };

  return row.redeemedAt === null
    ? { ...fields, status: "pending" }
    : {
        ...fields,
        status: "redeemed",
        redeemedAt: Temporal.Instant.fromEpochMilliseconds(row.redeemedAt),
      };
}

export function toSetupLinkRow(link: PendingSetupLink): SetupLinkRow {
  return {
    id: link.id,
    purpose: link.purpose,
    accountId: link.accountId ?? null,
    createdBy: link.createdBy ?? null,
    tokenHash: link.tokenHash,
    createdAt: link.createdAt.epochMilliseconds,
    expiresAt: link.expiresAt.epochMilliseconds,
    redeemedAt: null,
  };
}
