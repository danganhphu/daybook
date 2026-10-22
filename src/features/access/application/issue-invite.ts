import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import { issueSetupLink, type IssuedSetupLink, type IssueSetupLinkDeps } from "./issue-setup-link";

// A link for someone new, from a user signed in recently: whoever holds it makes an account. Valid ten minutes, used
// once; the newcomer names the account when they open it.
export async function issueInvite(
  deps: IssueSetupLinkDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<Result<IssuedSetupLink, Extract<AccessError, "step_up_required">>> {
  if (!Sessions.isFresh(session, deps.clock())) {
    return err("step_up_required");
  }

  return ok(
    await issueSetupLink(deps, { purpose: "invite", createdBy: session.accountId }, origin),
  );
}
