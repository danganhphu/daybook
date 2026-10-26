import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { accountIdSchema } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { SessionStores } from "./enlist-new-session";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type EndPersonSessionsDeps = StepUpDeps & {
  readonly accounts: AccountRepository;
  readonly sessions: SessionRepository;
  readonly startUnitOfWork: () => UnitOfWork<SessionStores>;
};

// The other person's phone was lost or stolen: this user signs out every device of theirs, after step-up. Their
// passkeys stay - the lost one is theirs to remove, once a recovery link lets them back in (ADR 0009, amended
// 2026-10-26). Both users see it in their activity. Answers how many ended.
export async function endPersonSessions(
  deps: EndPersonSessionsDeps,
  session: Session,
  accountId: unknown,
  origin: RequestOrigin,
): Promise<Result<number, Extract<AccessError, "step_up_required" | "not_found">>> {
  // Before anything is looked up, so a stale session learns nothing about which accounts exist
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  const parsed = accountIdSchema.safeParse(accountId);
  if (!parsed.success || parsed.data === session.accountId) {
    return err("not_found");
  }
  const account = await deps.accounts.get(parsed.data);
  if (account === undefined) {
    return err("not_found");
  }
  const ended = await deps.sessions.listForAccount(account.id);

  const work = deps.startUnitOfWork();
  work.sessions.removeAll(account.id);
  work.accessEvents.add(
    AccessEvents.record(
      "sessions_revoked",
      {
        accountId: account.id,
        actorId: session.accountId,
        sessionId: session.id,
        detail: { by: "other_user", ended: String(ended.length) },
      },
      origin,
      deps.clock(),
    ),
  );
  await work.commit();

  return ok(ended.length);
}
