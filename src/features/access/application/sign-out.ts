import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { SessionStores } from "./enlist-new-session";

export type SignOutDeps = {
  readonly clock: Clock;
  readonly startUnitOfWork: () => UnitOfWork<SessionStores>;
};

// Ends the session on the server; clearing the cookie is the adapter's half (ASVS 7.4.1)
export async function signOut(
  deps: SignOutDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<void> {
  const work = deps.startUnitOfWork();
  work.sessions.remove(session.id);
  work.accessEvents.add(
    AccessEvents.record(
      "session_ended",
      { accountId: session.accountId, actorId: session.accountId, sessionId: session.id },
      origin,
      deps.clock(),
    ),
  );
  await work.commit();
}
