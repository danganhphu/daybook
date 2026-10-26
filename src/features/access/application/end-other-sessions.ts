import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { SessionStores } from "./enlist-new-session";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type EndOtherSessionsDeps = StepUpDeps & {
  readonly sessions: SessionRepository;
  readonly startUnitOfWork: () => UnitOfWork<SessionStores>;
};

// Signs this account out everywhere but here, after a recent authentication (ASVS 7.5.2). Answers how many ended.
export async function endOtherSessions(
  deps: EndOtherSessionsDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<Result<number, Extract<AccessError, "step_up_required">>> {
  const now = deps.clock();
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  const others = (await deps.sessions.listForAccount(session.accountId)).filter(
    (other) => other.id !== session.id,
  );

  const work = deps.startUnitOfWork();
  work.sessions.removeAllExcept(session.accountId, session.id);
  work.accessEvents.add(
    AccessEvents.record(
      "other_sessions_ended",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: session.id,
        detail: { ended: String(others.length) },
      },
      origin,
      now,
    ),
  );
  await work.commit();

  return ok(others.length);
}
