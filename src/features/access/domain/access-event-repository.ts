import { Temporal } from "temporal-polyfill/implementation";

import type { AccountId } from "@/shared/domain/account-id";

import type { AccessEvent, AccessEventId, AccessEventKind } from "./access-event";

// Where a reader of the whole log stands: the last event it saw, by time then id
export type AccessLogPosition = {
  readonly occurredAt: Temporal.Instant;
  readonly id: AccessEventId;
};

// Reads only. Events are written through the unit of work and never change.
export type AccessEventRepository = {
  get(id: AccessEventId): Promise<AccessEvent | undefined>;
  // What happened to this account, and what it did to the other one, newest first
  // Newest first, on or after `since`
  listForAccount(
    accountId: AccountId,
    limit: number,
    since: Temporal.Instant,
  ): Promise<ReadonlyArray<AccessEvent>>;
  // When each account last signed in, for the people list; an account that never has is missing
  lastSignIns(): Promise<ReadonlyMap<AccountId, Temporal.Instant>>;
  // The events of these kinds about an account, in order after a position, up to a moment, at most `limit`
  listAfter(
    after: AccessLogPosition,
    upTo: Temporal.Instant,
    limit: number,
    kinds: ReadonlyArray<AccessEventKind>,
  ): Promise<ReadonlyArray<AccessEvent>>;
  // The newest event of any kind, at or before a moment when one is given
  latest(upTo?: Temporal.Instant): Promise<AccessEvent | undefined>;
};

export function isAfter(position: AccessLogPosition, than: AccessLogPosition): boolean {
  const byTime = Temporal.Instant.compare(position.occurredAt, than.occurredAt);

  return byTime > 0 || (byTime === 0 && position.id > than.id);
}
