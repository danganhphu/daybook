import type { AccessEvent } from "@/features/access/domain/access-event";

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
