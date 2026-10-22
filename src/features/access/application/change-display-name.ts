import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Accounts from "@/features/access/domain/account";
import type { Account, DisplayName } from "@/features/access/domain/account";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { AccessEventWrites, AccountWrites } from "./access-writes";

export type ChangeDisplayNameDeps = {
  readonly clock: Clock;
  readonly accounts: AccountRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly accounts: AccountWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// The name the app and the passkey manager show. Not a security setting, so no step-up (ADR 0009, decision 5).
export async function changeDisplayName(
  deps: ChangeDisplayNameDeps,
  session: Session,
  displayName: DisplayName,
  origin: RequestOrigin,
): Promise<Account> {
  const now = deps.clock();
  const account = await deps.accounts.get(session.accountId);
  if (account === undefined) {
    throw new Error(
      `Session ${session.id} names account ${session.accountId}, which does not exist`,
    );
  }
  if (account.displayName === displayName) {
    return account;
  }

  const renamed = Accounts.rename(account, displayName, now);
  const work = deps.startUnitOfWork();
  work.accounts.update(renamed);
  work.accessEvents.add(
    AccessEvents.record(
      "display_name_changed",
      { accountId: account.id, actorId: account.id, sessionId: session.id },
      origin,
      now,
    ),
  );
  await work.commit();

  return renamed;
}
