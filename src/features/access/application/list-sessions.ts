import type { AccountId } from "@/features/access/domain/account";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";

export type ListSessionsDeps = {
  readonly sessions: SessionRepository;
};

// The device list: every session of the account, most recently used first
export function listSessions(
  deps: ListSessionsDeps,
  accountId: AccountId,
): Promise<ReadonlyArray<Session>> {
  return deps.sessions.listForAccount(accountId);
}
