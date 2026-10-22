import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Account } from "@/features/access/domain/account";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import type { SetupLinkRepository } from "@/features/access/domain/setup-link-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, AccountWrites, CeremonyWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import { newAccount, type NewAccountDetails } from "./new-account";
import type { Secrets } from "./secrets";

export type NameInvitedAccountDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
  readonly accounts: AccountRepository;
  readonly setupLinks: SetupLinkRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly accounts: AccountWrites;
    readonly ceremonies: CeremonyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type NameInvitedAccountRequest = {
  readonly ceremonyCookie: string | undefined;
  readonly details: NewAccountDetails;
  readonly origin: RequestOrigin;
};

// The newcomer names the account an invite is for; the setup goes on to its passkey. The account exists from here,
// with no way in until the passkey is made: if they stop half-way, the people list shows it and the other user can
// send a recovery link. The setup link row is not touched - it is redeemed and stays as it was.
export async function nameInvitedAccount(
  deps: NameInvitedAccountDeps,
  request: NameInvitedAccountRequest,
): Promise<Result<Account, Extract<AccessError, "setup_link_unusable" | "username_taken">>> {
  const now = deps.clock();
  const setup = await findBoundCeremony(deps, request.ceremonyCookie, "setup");
  if (setup === undefined || Ceremonies.isExpired(setup, now) || setup.setupLinkId === undefined) {
    return err("setup_link_unusable");
  }
  const link = await deps.setupLinks.get(setup.setupLinkId);
  if (link === undefined || link.purpose !== "invite") {
    return err("setup_link_unusable");
  }

  // Named already, by this browser a moment ago: the same answer again, so a retried request does no harm
  if (setup.accountId !== undefined) {
    const named = await deps.accounts.get(setup.accountId);
    return named === undefined ? err("setup_link_unusable") : ok(named);
  }

  // Two newcomers taking the same name at once meet the unique index, which throws; this gives the ordinary case
  // its sentence
  if ((await deps.accounts.findByUsername(request.details.username)) !== undefined) {
    return err("username_taken");
  }

  const account = newAccount(deps.secrets, request.details, now);
  const work = deps.startUnitOfWork();
  work.accounts.add(account);
  work.ceremonies.setAccount(setup.id, account.id);
  work.accessEvents.add(
    AccessEvents.record(
      "account_created",
      {
        accountId: account.id,
        actorId: link.createdBy,
        detail: { via: "invite", setupLink: link.id },
      },
      request.origin,
      now,
    ),
  );
  await work.commit();

  return ok(account);
}
