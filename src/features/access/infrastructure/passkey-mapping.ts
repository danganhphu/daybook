import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { accountIdSchema } from "@/features/access/domain/account";
import {
  credentialIdSchema,
  isPasskeyAlgorithm,
  passkeyIdSchema,
  type Passkey,
} from "@/features/access/domain/passkey";
import { deviceLabelSchema } from "@/features/access/domain/session";

import type { passkeyTable } from "./passkey.table";

type PasskeyRow = typeof passkeyTable.$inferSelect;

const transportsSchema = z.array(z.string());

export function toPasskey(row: PasskeyRow): Passkey {
  if (!isPasskeyAlgorithm(row.algorithm)) {
    throw new Error(`Passkey ${row.id} has algorithm ${row.algorithm}, which is never stored`);
  }

  return {
    id: passkeyIdSchema.parse(row.id),
    accountId: accountIdSchema.parse(row.accountId),
    credentialId: credentialIdSchema.parse(row.credentialId),
    publicKey: row.publicKey,
    algorithm: row.algorithm,
    signCount: row.signCount,
    transports: transportsSchema.parse(JSON.parse(row.transports)),
    aaguid: row.aaguid,
    backupEligible: row.backupEligible === 1,
    backedUp: row.backedUp === 1,
    name: deviceLabelSchema.parse(row.name),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    lastUsedAt:
      row.lastUsedAt === null ? undefined : Temporal.Instant.fromEpochMilliseconds(row.lastUsedAt),
  };
}

export function toPasskeyRow(passkey: Passkey): PasskeyRow {
  return {
    id: passkey.id,
    accountId: passkey.accountId,
    credentialId: passkey.credentialId,
    publicKey: passkey.publicKey,
    algorithm: passkey.algorithm,
    signCount: passkey.signCount,
    transports: JSON.stringify(passkey.transports),
    aaguid: passkey.aaguid,
    backupEligible: passkey.backupEligible ? 1 : 0,
    backedUp: passkey.backedUp ? 1 : 0,
    name: passkey.name,
    createdAt: passkey.createdAt.epochMilliseconds,
    lastUsedAt: passkey.lastUsedAt?.epochMilliseconds ?? null,
  };
}
