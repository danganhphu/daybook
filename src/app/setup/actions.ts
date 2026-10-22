"use server";

import { daybook } from "@/composition/daybook";
import * as Setup from "@/features/access/web/access-commands";
import type { NamingProblem, SetupView } from "@/features/access/web/access-commands";
import { ceremonyCookieName } from "@/features/access/web/cookie-names";
import {
  clearCeremonyCookie,
  readCookie,
  requestOrigin,
  setCeremonyCookie,
  setSessionCookie,
} from "@/features/access/web/request-context";
import { currentSession } from "@/features/access/web/session-gate";
import { ok, type Result } from "@/shared/domain/result";

// Public: a setup link is how someone with no way in gets one. The link's token is the proof, used once; after that
// the ceremony cookie ties the steps to this browser.

export async function beginSetup(token: unknown): Promise<Result<SetupView, string>> {
  const begun = await Setup.beginSetup(daybook(), token, await requestOrigin());
  if (!begun.ok) {
    return begun;
  }

  await setCeremonyCookie(begun.value.ceremonyCookie);

  return ok(begun.value.view);
}

// The page was opened again without its token: carry on from the cookie
export async function resumeSetup(): Promise<Result<SetupView, string>> {
  return Setup.resumeSetup(daybook(), await readCookie(ceremonyCookieName));
}

export async function nameAccount(
  displayName: unknown,
  username: unknown,
): Promise<Result<PublicKeyCredentialCreationOptionsJSON, NamingProblem>> {
  return Setup.nameAccount(daybook(), {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    displayName,
    username,
    origin: await requestOrigin(),
  });
}

// A new prompt after the person cancelled, or after the passkey was refused
export async function retrySetup(): Promise<
  Result<PublicKeyCredentialCreationOptionsJSON, string>
> {
  return Setup.promptForSetup(daybook(), await readCookie(ceremonyCookieName));
}

export async function completeSetup(response: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const finished = await Setup.finishSetup(app, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    response,
    origin: await requestOrigin(),
    current: await currentSession(app),
  });
  // A refused passkey keeps the setup, so the person can try again within its ten minutes
  if (!finished.ok) {
    return finished;
  }

  await clearCeremonyCookie();
  await setSessionCookie(finished.value);

  return ok(null);
}
