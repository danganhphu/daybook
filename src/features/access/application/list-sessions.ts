import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { Clock } from "@/shared/application/clock";
import type { AccountId } from "@/shared/domain/account-id";

export type ListSessionsDeps = {
  readonly clock: Clock;
  readonly sessions: SessionRepository;
};

// The device list: every session of the account still running, most recently used first. One that ran out stays in
// D1 until it is next presented, and is not shown.
export async function listSessions(
  deps: ListSessionsDeps,
  accountId: AccountId,
): Promise<ReadonlyArray<Session>> {
  const now = deps.clock();

  return (await deps.sessions.listForAccount(accountId)).filter(
    (session) => !Sessions.isExpired(session, now),
  );
}
