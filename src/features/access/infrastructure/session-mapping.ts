import { Temporal } from "temporal-polyfill/implementation";

import { accountIdSchema } from "@/features/access/domain/account";
import { passkeyIdSchema } from "@/features/access/domain/passkey";
import { secretHashSchema } from "@/features/access/domain/secret";
import { deviceLabelSchema, sessionIdSchema, type Session } from "@/features/access/domain/session";

import type { sessionTable } from "./session.table";

type SessionRow = typeof sessionTable.$inferSelect;

export function toSession(row: SessionRow): Session {
  return {
    id: sessionIdSchema.parse(row.id),
    accountId: accountIdSchema.parse(row.accountId),
    verifier: secretHashSchema.parse(row.verifier),
    method: row.method,
    passkeyId: row.passkeyId === null ? undefined : passkeyIdSchema.parse(row.passkeyId),
    authenticatedAt: Temporal.Instant.fromEpochMilliseconds(row.authenticatedAt),
    expiresAt: Temporal.Instant.fromEpochMilliseconds(row.expiresAt),
    lastSeenAt: Temporal.Instant.fromEpochMilliseconds(row.lastSeenAt),
    deviceLabel: deviceLabelSchema.parse(row.deviceLabel),
  };
}

export function toSessionRow(session: Session): SessionRow {
  return {
    id: session.id,
    accountId: session.accountId,
    verifier: session.verifier,
    method: session.method,
    passkeyId: session.passkeyId ?? null,
    authenticatedAt: session.authenticatedAt.epochMilliseconds,
    expiresAt: session.expiresAt.epochMilliseconds,
    lastSeenAt: session.lastSeenAt.epochMilliseconds,
    deviceLabel: session.deviceLabel,
  };
}
