import type { App } from "@/composition/create-app";
import { accessErrorMessages, type AccessError } from "@/features/access/application/access-errors";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import type { Session } from "@/features/access/domain/session";
import { err, ok, type Result } from "@/shared/domain/result";

import {
  sessionCookie,
  type CookieToSet,
  type PasswordPromptView,
  type Prompt,
} from "./access-commands";
import { fieldFallbacks, firstIssue } from "./field-issues";
import { setupLinkUrl } from "./setup-link-url";

// What the account settings do for each request, minus the framework. A refusal carries its code as well as its
// sentence, so the page knows when to ask for step-up and try again.

// "invalid": input the page let through and the server refused. Two only the page sees: "fault", no answer at all,
// and "cancelled", the person closed the step-up instead of confirming.
export type Problem = {
  readonly code: AccessError | "invalid" | "fault" | "cancelled";
  readonly message: string;
};

export type SettingsResult<T> = Result<T, Problem>;

function problem(code: AccessError): Problem {
  return { code, message: accessErrorMessages[code] };
}

function settle<T, E extends AccessError>(result: Result<T, E>): SettingsResult<T> {
  return result.ok ? result : err(problem(result.error));
}

export async function renameAccount(
  app: App,
  session: Session,
  displayName: unknown,
  origin: RequestOrigin,
): Promise<SettingsResult<null>> {
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return err({ code: "invalid", message: firstIssue(parsed.error, fieldFallbacks.displayName) });
  }
  await app.changeDisplayName(session, parsed.data, origin);

  return ok(null);
}

export async function renameUsername(
  app: App,
  session: Session,
  username: unknown,
  origin: RequestOrigin,
): Promise<SettingsResult<null>> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return err({ code: "invalid", message: firstIssue(parsed.error, fieldFallbacks.username) });
  }
  const changed = await app.changeUsername(session, parsed.data, origin);

  return changed.ok ? ok(null) : err(problem(changed.error));
}

export async function promptForNewPasskey(
  app: App,
  session: Session,
): Promise<SettingsResult<Prompt<PublicKeyCredentialCreationOptionsJSON>>> {
  return settle(await app.startAddingPasskey(session));
}

export async function saveNewPasskey(
  app: App,
  session: Session,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly response: unknown;
    readonly origin: RequestOrigin;
  },
): Promise<SettingsResult<null>> {
  const added = await app.finishAddingPasskey(session, request);

  return added.ok ? ok(null) : err(problem(added.error));
}

export async function deletePasskey(
  app: App,
  session: Session,
  passkeyId: unknown,
  origin: RequestOrigin,
): Promise<SettingsResult<null>> {
  return settle(await app.removePasskey(session, passkeyId, origin));
}

export async function promptForNewPassword(
  app: App,
  session: Session,
): Promise<SettingsResult<Prompt<PasswordPromptView>>> {
  const prompt = await app.beginPasswordChange(session);

  return prompt.ok
    ? ok({
        options: { salt: prompt.value.salt, parameters: prompt.value.parameters },
        ceremonyCookie: prompt.value.ceremonyCookie,
      })
    : err(problem(prompt.error));
}

export async function saveNewPassword(
  app: App,
  session: Session,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly key: unknown;
    readonly origin: RequestOrigin;
  },
): Promise<SettingsResult<null>> {
  return settle(await app.finishPasswordChange(session, request));
}

export async function endDevice(
  app: App,
  session: Session,
  sessionId: unknown,
  origin: RequestOrigin,
): Promise<SettingsResult<null>> {
  return settle(await app.endSession(session, sessionId, origin));
}

export async function endOtherDevices(
  app: App,
  session: Session,
  origin: RequestOrigin,
): Promise<SettingsResult<null>> {
  const ended = await app.endOtherSessions(session, origin);

  return ended.ok ? ok(null) : err(problem(ended.error));
}

// A setup link as the page shows it: the whole URL, once, never stored on either side
export type IssuedLinkView = { readonly url: string };

export async function inviteSomeone(
  app: App,
  session: Session,
  origin: RequestOrigin,
  appOrigin: URL,
): Promise<SettingsResult<IssuedLinkView>> {
  const issued = await app.issueInvite(session, origin);

  return issued.ok
    ? ok({ url: setupLinkUrl(appOrigin, issued.value.token) })
    : err(problem(issued.error));
}

export async function recoveryLinkFor(
  app: App,
  session: Session,
  accountId: unknown,
  origin: RequestOrigin,
  appOrigin: URL,
): Promise<SettingsResult<IssuedLinkView>> {
  const issued = await app.issueRecoveryLink(session, accountId, origin);

  return issued.ok
    ? ok({ url: setupLinkUrl(appOrigin, issued.value.token) })
    : err(problem(issued.error));
}

// Step-up: a passkey sign-in scoped to this account, which replaces the session with a fresh one
export async function promptForStepUp(
  app: App,
  session: Session,
  origin: RequestOrigin,
): Promise<SettingsResult<Prompt<PublicKeyCredentialRequestOptionsJSON>>> {
  return settle(await app.startPasskeySignIn({ origin, stepUp: session }));
}

export async function completeStepUp(
  app: App,
  session: Session,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly response: unknown;
    readonly origin: RequestOrigin;
  },
): Promise<SettingsResult<CookieToSet>> {
  const opened = await app.finishPasskeySignIn({ ...request, current: session });

  return opened.ok ? ok(sessionCookie(opened.value)) : err(problem(opened.error));
}
