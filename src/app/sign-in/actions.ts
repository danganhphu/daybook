"use server";

import { daybook } from "@/composition/daybook";
import {
  promptForPasswordSignIn,
  promptForSignIn,
  signInWithPasskey,
  signInWithPassword,
  type PasswordPromptView,
} from "@/features/access/web/access-commands";
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

// Public: this is how a session comes to exist, so nothing here can ask for one. Each call is rate limited and bound
// to the browser by the ceremony cookie.

// The prompt the screen holds ready, so the tap can open Face ID at once (Safari needs the gesture unbroken)
export async function prepareSignIn(): Promise<
  Result<PublicKeyCredentialRequestOptionsJSON, string>
> {
  const prompt = await promptForSignIn(daybook(), await requestOrigin());
  if (!prompt.ok) {
    return prompt;
  }

  await setCeremonyCookie(prompt.value.ceremonyCookie);

  return ok(prompt.value.options);
}

// The salt and cost for turning the typed password into a key, in the browser
export async function preparePasswordSignIn(
  username: unknown,
): Promise<Result<PasswordPromptView, string>> {
  const prompt = await promptForPasswordSignIn(daybook(), username, await requestOrigin());
  if (!prompt.ok) {
    return prompt;
  }

  await setCeremonyCookie(prompt.value.ceremonyCookie);

  return ok(prompt.value.options);
}

export async function completePasswordSignIn(key: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const signedIn = await signInWithPassword(app, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    key,
    origin: await requestOrigin(),
    current: await currentSession(app),
  });
  await clearCeremonyCookie();
  if (!signedIn.ok) {
    return signedIn;
  }

  await setSessionCookie(signedIn.value);

  return ok(null);
}

export async function completeSignIn(response: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const signedIn = await signInWithPasskey(app, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    response,
    origin: await requestOrigin(),
    current: await currentSession(app),
  });
  // Spent either way: the server deleted the prompt
  await clearCeremonyCookie();
  if (!signedIn.ok) {
    return signedIn;
  }

  await setSessionCookie(signedIn.value);

  return ok(null);
}
