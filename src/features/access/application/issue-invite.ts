import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Session } from "@/features/access/domain/session";
import { bookPeople, hasWayIn } from "@/features/access/domain/way-in";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import { issueSetupLink, type IssuedSetupLink, type IssueSetupLinkDeps } from "./issue-setup-link";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type IssueInviteDeps = IssueSetupLinkDeps &
  StepUpDeps & {
    readonly accounts: AccountRepository;
    readonly passwords: PasswordRepository;
  };

// How many accounts someone can sign in to; an invite left half-way is not one
async function peopleWithWayIn(
  deps: { readonly passkeys: PasskeyRepository } & Pick<IssueInviteDeps, "accounts" | "passwords">,
): Promise<number> {
  const [accounts, passkeys, passwords] = await Promise.all([
    deps.accounts.list(),
    deps.passkeys.list(),
    deps.passwords.list(),
  ]);

  return accounts.filter((account) =>
    hasWayIn(
      passkeys.filter((passkey) => passkey.accountId === account.id),
      passwords.find((password) => password.accountId === account.id),
    ),
  ).length;
}

// A link for someone new, from a user signed in recently: whoever holds it makes an account. Valid ten minutes, used
// once; the newcomer names the account when they open it. Refused once the book has its two people: a new account
// reads and changes everything, so a third is the operator's to add.
export async function issueInvite(
  deps: IssueInviteDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<Result<IssuedSetupLink, Extract<AccessError, "step_up_required" | "book_full">>> {
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }
  if ((await peopleWithWayIn(deps)) >= bookPeople) {
    return err("book_full");
  }

  return ok(
    await issueSetupLink(deps, { purpose: "invite", createdBy: session.accountId }, origin),
  );
}
