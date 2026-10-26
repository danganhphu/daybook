import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Session } from "@/features/access/domain/session";
import { accountIdSchema } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import { issueSetupLink, type IssuedSetupLink, type IssueSetupLinkDeps } from "./issue-setup-link";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type IssueRecoveryLinkDeps = IssueSetupLinkDeps &
  StepUpDeps & { readonly accounts: AccountRepository };

// A way back in for the other user, who lost their phone or their passkeys. Using it adds a passkey and signs out
// every other device of theirs; their old passkeys stay for them to remove. Their own account needs no link: signed
// in, they add a passkey from their settings.
export async function issueRecoveryLink(
  deps: IssueRecoveryLinkDeps,
  session: Session,
  accountId: unknown,
  origin: RequestOrigin,
): Promise<Result<IssuedSetupLink, Extract<AccessError, "step_up_required" | "not_found">>> {
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

  return ok(
    await issueSetupLink(
      deps,
      { purpose: "recovery", accountId: account.id, createdBy: session.accountId },
      origin,
    ),
  );
}
