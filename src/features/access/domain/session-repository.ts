import type { AccountId } from "@/shared/domain/account-id";

import type { Session, SessionId } from "./session";

// Reads only. Writes go through the application's unit of work.
export type SessionRepository = {
  get(id: SessionId): Promise<Session | undefined>;
  // Most recently used first
  listForAccount(accountId: AccountId): Promise<ReadonlyArray<Session>>;
};
