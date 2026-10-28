import type { Temporal } from "temporal-polyfill/implementation";

import type { AccountId } from "@/shared/domain/account-id";

import type { AccessEvent, AccessEventId } from "./access-event";

// Where a reader of the whole log stands: the last event it saw, by time then id
export type AccessLogPosition = {
  readonly occurredAt: Temporal.Instant;
  readonly id: AccessEventId;
};

// Reads only. Events are written through the unit of work and never change.
export type AccessEventRepository = {
  get(id: AccessEventId): Promise<AccessEvent | undefined>;
  // What happened to this account, and what it did to the other one, newest first
  listForAccount(accountId: AccountId, limit: number): Promise<ReadonlyArray<AccessEvent>>;
  // When each account last signed in, for the people list; an account that never has is missing
  lastSignIns(): Promise<ReadonlyMap<AccountId, Temporal.Instant>>;
  // The log in order after a position, up to a moment, at most `limit`
  listAfter(
    after: AccessLogPosition,
    upTo: Temporal.Instant,
    limit: number,
  ): Promise<ReadonlyArray<AccessEvent>>;
  latest(): Promise<AccessEvent | undefined>;
};
