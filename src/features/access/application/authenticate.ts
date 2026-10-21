import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { SessionWrites } from "./access-writes";
import { secretTokenMatches } from "./secret-tokens";
import type { Secrets } from "./secrets";
import { parseSessionCookie } from "./session-cookie";

export type AuthenticateDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly sessions: SessionRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly sessions: SessionWrites }>;
};

// Every page and server action starts here. A missing, malformed, forged, ended or expired cookie all answer the
// same: unauthenticated.
export async function authenticate(
  deps: AuthenticateDeps,
  cookie: string | undefined,
): Promise<Result<Session, Extract<AccessError, "unauthenticated">>> {
  const presented = cookie === undefined ? undefined : parseSessionCookie(cookie);
  if (presented === undefined) {
    return err("unauthenticated");
  }

  const session = await deps.sessions.get(presented.sessionId);
  if (
    session === undefined ||
    !(await secretTokenMatches(deps.secrets, presented.secret, session.verifier))
  ) {
    return err("unauthenticated");
  }

  const now = deps.clock();
  if (Sessions.isExpired(session, now)) {
    const work = deps.startUnitOfWork();
    work.sessions.remove(session.id);
    await work.commit();

    return err("unauthenticated");
  }

  if (!Sessions.isSeenLongAgo(session, now)) {
    return ok(session);
  }

  const seen = Sessions.markSeen(session, now);
  const work = deps.startUnitOfWork();
  work.sessions.markSeen(seen);
  await work.commit();

  return ok(seen);
}
