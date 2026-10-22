import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Accounts from "@/features/access/domain/account";
import type { Account, Username } from "@/features/access/domain/account";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, AccountWrites } from "./access-writes";

export type ChangeUsernameDeps = {
  readonly clock: Clock;
  readonly accounts: AccountRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly accounts: AccountWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// The name the fallback password signs in with, so a security setting: step-up first. Two at once for the same name
// meet the unique index, which throws; the check here gives the ordinary case its sentence.
export async function changeUsername(
  deps: ChangeUsernameDeps,
  session: Session,
  username: Username,
  origin: RequestOrigin,
): Promise<Result<Account, Extract<AccessError, "step_up_required" | "username_taken">>> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now)) {
    return err("step_up_required");
  }

  const account = await deps.accounts.get(session.accountId);
  if (account === undefined) {
    throw new Error(
      `Session ${session.id} names account ${session.accountId}, which does not exist`,
    );
  }
  if (account.username === username) {
    return ok(account);
  }
  if ((await deps.accounts.findByUsername(username)) !== undefined) {
    return err("username_taken");
  }

  const changed = Accounts.changeUsername(account, username, now);
  const work = deps.startUnitOfWork();
  work.accounts.update(changed);
  work.accessEvents.add(
    AccessEvents.record(
      "username_changed",
      {
        accountId: account.id,
        actorId: account.id,
        sessionId: session.id,
        detail: { from: account.username, to: username },
      },
      origin,
      now,
    ),
  );
  await work.commit();

  return ok(changed);
}
