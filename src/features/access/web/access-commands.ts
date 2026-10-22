import type { App } from "@/composition/create-app";
import { accessErrorMessages } from "@/features/access/application/access-errors";
import type { OpenedSession } from "@/features/access/application/enlist-new-session";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import type { Argon2Parameters } from "@/features/access/domain/password";
import type { Session } from "@/features/access/domain/session";
import type { SetupLinkPurpose } from "@/features/access/domain/setup-link";
import { err, ok, type Result } from "@/shared/domain/result";

import { fieldFallbacks, firstIssue } from "./field-issues";

// What the web adapter does for sign-in and setup, minus the framework: call the app and answer with what the page
// needs, or the sentence the person should read. Server actions wrap these and handle the cookies.

export type CookieToSet = {
  readonly value: string;
  readonly maxAgeSeconds: number;
};

export type Prompt<Options> = {
  readonly options: Options;
  readonly ceremonyCookie: string;
};

export function sessionCookie(opened: OpenedSession): CookieToSet {
  return {
    value: opened.cookie,
    // Until the session ends and not a second longer; the server refuses it after that anyway
    maxAgeSeconds: Math.floor(
      opened.session.expiresAt.since(opened.session.authenticatedAt).total("seconds"),
    ),
  };
}

export async function promptForSignIn(
  app: App,
  origin: RequestOrigin,
  stepUp?: Session,
): Promise<Result<Prompt<PublicKeyCredentialRequestOptionsJSON>, string>> {
  const prompt = await app.startPasskeySignIn({
    origin,
    ...(stepUp === undefined ? {} : { stepUp }),
  });

  return prompt.ok ? prompt : err(accessErrorMessages[prompt.error]);
}

export async function signInWithPasskey(
  app: App,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly response: unknown;
    readonly origin: RequestOrigin;
    readonly current: Session | undefined;
  },
): Promise<Result<CookieToSet, string>> {
  const opened = await app.finishPasskeySignIn(request);

  return opened.ok ? ok(sessionCookie(opened.value)) : err(accessErrorMessages[opened.error]);
}

// Where the setup screen stands: an invite asks for a name first, then every setup for its passkey
export type SetupStep =
  | { readonly kind: "name" }
  | { readonly kind: "passkey"; readonly options: PublicKeyCredentialCreationOptionsJSON };

export type SetupView = { readonly purpose: SetupLinkPurpose; readonly step: SetupStep };

async function setupView(
  app: App,
  ceremonyCookie: string,
  purpose: SetupLinkPurpose,
  next: SetupStep["kind"],
): Promise<Result<SetupView, string>> {
  if (next === "name") {
    return ok({ purpose, step: { kind: "name" } });
  }
  const options = await app.startPasskeySetup(ceremonyCookie);

  return options.ok
    ? ok({ purpose, step: { kind: "passkey", options: options.value } })
    : err(accessErrorMessages[options.error]);
}

// A setup link's token, from the page's URL fragment, turned into a ceremony and its first step
export async function beginSetup(
  app: App,
  token: unknown,
  origin: RequestOrigin,
): Promise<Result<{ readonly view: SetupView; readonly ceremonyCookie: string }, string>> {
  const grant = await app.redeemSetupLink(typeof token === "string" ? token : "", origin);
  if (!grant.ok) {
    return err(accessErrorMessages[grant.error]);
  }

  const view = await setupView(
    app,
    grant.value.cookie,
    grant.value.purpose,
    grant.value.purpose === "invite" ? "name" : "passkey",
  );

  return view.ok ? ok({ view: view.value, ceremonyCookie: grant.value.cookie }) : view;
}

// The same setup after a reload, from the ceremony cookie alone: the token left the address bar when first read
export async function resumeSetup(
  app: App,
  ceremonyCookie: string | undefined,
): Promise<Result<SetupView, string>> {
  const progress = await app.resumeSetup(ceremonyCookie);
  if (!progress.ok || ceremonyCookie === undefined) {
    return err(accessErrorMessages.setup_link_unusable);
  }

  return setupView(app, ceremonyCookie, progress.value.purpose, progress.value.next);
}

// Each field's own sentence, under the field; a refusal of the whole step goes above the button
export type NamingProblem = {
  readonly displayName?: string;
  readonly username?: string;
  readonly form?: string;
};

// The newcomer's name and username for an invite, then the passkey prompt for the account they made
export async function nameAccount(
  app: App,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly displayName: unknown;
    readonly username: unknown;
    readonly origin: RequestOrigin;
  },
): Promise<Result<PublicKeyCredentialCreationOptionsJSON, NamingProblem>> {
  const displayName = displayNameSchema.safeParse(request.displayName);
  const username = usernameSchema.safeParse(request.username);
  if (!displayName.success || !username.success) {
    return err({
      ...(displayName.success
        ? {}
        : { displayName: firstIssue(displayName.error, fieldFallbacks.displayName) }),
      ...(username.success
        ? {}
        : { username: firstIssue(username.error, fieldFallbacks.username) }),
    });
  }

  const named = await app.nameInvitedAccount({
    ceremonyCookie: request.ceremonyCookie,
    details: { displayName: displayName.data, username: username.data },
    origin: request.origin,
  });
  if (!named.ok) {
    const message = accessErrorMessages[named.error];
    return err(named.error === "username_taken" ? { username: message } : { form: message });
  }

  const options = await app.startPasskeySetup(request.ceremonyCookie);

  return options.ok ? options : err({ form: accessErrorMessages[options.error] });
}

export type PasswordPromptView = {
  readonly salt: string;
  readonly parameters: Argon2Parameters;
};

// The salt and cost for the username typed, real or decoy; the page cannot tell which, and neither can anyone else
export async function promptForPasswordSignIn(
  app: App,
  username: unknown,
  origin: RequestOrigin,
): Promise<Result<Prompt<PasswordPromptView>, string>> {
  const prompt = await app.beginPasswordSignIn(username, origin);

  return prompt.ok
    ? ok({
        options: { salt: prompt.value.salt, parameters: prompt.value.parameters },
        ceremonyCookie: prompt.value.ceremonyCookie,
      })
    : err(accessErrorMessages[prompt.error]);
}

export async function signInWithPassword(
  app: App,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly key: unknown;
    readonly origin: RequestOrigin;
    readonly current: Session | undefined;
  },
): Promise<Result<CookieToSet, string>> {
  const opened = await app.finishPasswordSignIn(request);

  return opened.ok ? ok(sessionCookie(opened.value)) : err(accessErrorMessages[opened.error]);
}

// Another prompt for a setup already begun, after the person cancelled or the passkey was refused
export async function promptForSetup(
  app: App,
  ceremonyCookie: string | undefined,
): Promise<Result<PublicKeyCredentialCreationOptionsJSON, string>> {
  const options = await app.startPasskeySetup(ceremonyCookie);

  return options.ok ? options : err(accessErrorMessages[options.error]);
}

export async function finishSetup(
  app: App,
  request: {
    readonly ceremonyCookie: string | undefined;
    readonly response: unknown;
    readonly origin: RequestOrigin;
    readonly current: Session | undefined;
  },
): Promise<Result<CookieToSet, string>> {
  const finished = await app.finishPasskeySetup({
    ceremonyCookie: request.ceremonyCookie,
    response: request.response,
    origin: request.origin,
    replacing: request.current?.id,
  });

  return finished.ok ? ok(sessionCookie(finished.value)) : err(accessErrorMessages[finished.error]);
}
