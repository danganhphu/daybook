import type { Temporal } from "temporal-polyfill/implementation";

import type { AccessEvent } from "./access-event";
import type { AccountId } from "./account";

// Reads only. Events are written through the unit of work and never change.
export type AccessEventRepository = {
  // What happened to this account, and what it did to the other one, newest first
  listForAccount(accountId: AccountId, limit: number): Promise<ReadonlyArray<AccessEvent>>;
  // When each account last signed in, for the people list; an account that never has is missing
  lastSignIns(): Promise<ReadonlyMap<AccountId, Temporal.Instant>>;
};
