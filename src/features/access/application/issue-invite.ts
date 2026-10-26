import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import { issueSetupLink, type IssuedSetupLink, type IssueSetupLinkDeps } from "./issue-setup-link";
import { isSteppedUp, type StepUpDeps } from "./step-up";

// A link for someone new, from a user signed in recently: whoever holds it makes an account. Valid ten minutes, used
// once; the newcomer names the account when they open it.
export async function issueInvite(
  deps: IssueSetupLinkDeps & StepUpDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<Result<IssuedSetupLink, Extract<AccessError, "step_up_required">>> {
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  return ok(
    await issueSetupLink(deps, { purpose: "invite", createdBy: session.accountId }, origin),
  );
}
