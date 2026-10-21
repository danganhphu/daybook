import { Temporal } from "temporal-polyfill/implementation";

import { accountIdSchema } from "@/features/access/domain/account";
import { ceremonyIdSchema, type Ceremony } from "@/features/access/domain/ceremony";
import { secretHashSchema } from "@/features/access/domain/secret";
import { setupLinkIdSchema } from "@/features/access/domain/setup-link";

import type { ceremonyTable } from "./ceremony.table";

type CeremonyRow = typeof ceremonyTable.$inferSelect;

export function toCeremony(row: CeremonyRow): Ceremony {
  return {
    id: ceremonyIdSchema.parse(row.id),
    kind: row.kind,
    bindingHash: secretHashSchema.parse(row.bindingHash),
    accountId: row.accountId === null ? undefined : accountIdSchema.parse(row.accountId),
    setupLinkId: row.setupLinkId === null ? undefined : setupLinkIdSchema.parse(row.setupLinkId),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    expiresAt: Temporal.Instant.fromEpochMilliseconds(row.expiresAt),
  };
}

export function toCeremonyRow(ceremony: Ceremony): CeremonyRow {
  return {
    id: ceremony.id,
    kind: ceremony.kind,
    bindingHash: ceremony.bindingHash,
    accountId: ceremony.accountId ?? null,
    setupLinkId: ceremony.setupLinkId ?? null,
    createdAt: ceremony.createdAt.epochMilliseconds,
    expiresAt: ceremony.expiresAt.epochMilliseconds,
  };
}
