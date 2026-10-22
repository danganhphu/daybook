import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Sessions from "@/features/access/domain/session";
import { sessionIdSchema, type Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { SessionStores } from "./enlist-new-session";

export type EndSessionDeps = {
  readonly clock: Clock;
  readonly sessions: SessionRepository;
  readonly startUnitOfWork: () => UnitOfWork<SessionStores>;
};

// Signs out one other device of this account - the phone that was lost - after a recent sign-in. This device signs
// out through sign-out instead, and another account's sessions are nobody's to end from here.
export async function endSession(
  deps: EndSessionDeps,
  session: Session,
  otherId: unknown,
  origin: RequestOrigin,
): Promise<Result<null, Extract<AccessError, "step_up_required" | "not_found">>> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now)) {
    return err("step_up_required");
  }

  const id = sessionIdSchema.safeParse(otherId);
  const other = id.success ? await deps.sessions.get(id.data) : undefined;
  if (other === undefined || other.accountId !== session.accountId || other.id === session.id) {
    return err("not_found");
  }

  const work = deps.startUnitOfWork();
  work.sessions.remove(other.id);
  work.accessEvents.add(
    AccessEvents.record(
      "session_ended",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: other.id,
        detail: { by: "another_device" },
      },
      origin,
      now,
    ),
  );
  await work.commit();

  return ok(null);
}
