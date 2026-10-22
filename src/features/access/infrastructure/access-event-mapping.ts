import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import {
  accessEventIdSchema,
  ipAddressSchema,
  type AccessEvent,
} from "@/features/access/domain/access-event";
import { accountIdSchema } from "@/features/access/domain/account";
import { passkeyIdSchema } from "@/features/access/domain/passkey";
import { deviceLabelSchema, sessionIdSchema } from "@/features/access/domain/session";

import type { accessEventTable } from "./access-event.table";

type AccessEventRow = typeof accessEventTable.$inferSelect;

export function toAccessEventRow(event: AccessEvent): AccessEventRow {
  return {
    id: event.id,
    occurredAt: event.occurredAt.epochMilliseconds,
    kind: event.kind,
    accountId: event.accountId ?? null,
    actorId: event.actorId ?? null,
    sessionId: event.sessionId ?? null,
    passkeyId: event.passkeyId ?? null,
    ip: event.ip ?? null,
    deviceLabel: event.deviceLabel,
    detail: event.detail === undefined ? null : JSON.stringify(event.detail),
  };
}

const detailSchema = z.record(z.string(), z.string());

const optional = <T>(value: string | null, parse: (text: string) => T) =>
  value === null ? undefined : parse(value);

export function toAccessEvent(row: AccessEventRow): AccessEvent {
  return {
    id: accessEventIdSchema.parse(row.id),
    occurredAt: Temporal.Instant.fromEpochMilliseconds(row.occurredAt),
    kind: row.kind,
    accountId: optional(row.accountId, (id) => accountIdSchema.parse(id)),
    actorId: optional(row.actorId, (id) => accountIdSchema.parse(id)),
    sessionId: optional(row.sessionId, (id) => sessionIdSchema.parse(id)),
    passkeyId: optional(row.passkeyId, (id) => passkeyIdSchema.parse(id)),
    ip: optional(row.ip, (ip) => ipAddressSchema.parse(ip)),
    deviceLabel: deviceLabelSchema.parse(row.deviceLabel),
    detail: optional(row.detail, (detail) => detailSchema.parse(JSON.parse(detail))),
  };
}
