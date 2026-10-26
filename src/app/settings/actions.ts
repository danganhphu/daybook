"use server";

import { refresh } from "next/cache";

import { appOrigin, daybook } from "@/composition/daybook";
import type { PasswordPromptView } from "@/features/access/web/access-commands";
import { ceremonyCookieName } from "@/features/access/web/cookie-names";
import {
  clearCeremonyCookie,
  readCookie,
  requestOrigin,
  setCeremonyCookie,
  setSessionCookie,
} from "@/features/access/web/request-context";
import { requireSession } from "@/features/access/web/session-gate";
import * as Settings from "@/features/access/web/settings-commands";
import type { SettingsResult } from "@/features/access/web/settings-commands";
import { ok } from "@/shared/domain/result";

// The account settings' actions. Each checks the session first; the security ones are checked for step-up again by
// the use case, whatever the page asked before. A success refreshes the page so it shows what changed.

function refreshOnSuccess<T>(result: SettingsResult<T>): SettingsResult<T> {
  if (result.ok) {
    refresh();
  }

  return result;
}

export async function renameAccount(displayName: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.renameAccount(app, session, displayName, await requestOrigin()),
  );
}

export async function renameUsername(username: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.renameUsername(app, session, username, await requestOrigin()),
  );
}

export async function beginAddingPasskey(): Promise<
  SettingsResult<PublicKeyCredentialCreationOptionsJSON>
> {
  const app = daybook();
  const session = await requireSession(app);
  const prompt = await Settings.promptForNewPasskey(app, session);
  if (!prompt.ok) {
    return prompt;
  }
  await setCeremonyCookie(prompt.value.ceremonyCookie);

  return ok(prompt.value.options);
}

export async function finishAddingPasskey(response: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);
  const added = await Settings.saveNewPasskey(app, session, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    response,
    origin: await requestOrigin(),
  });
  await clearCeremonyCookie();

  return refreshOnSuccess(added);
}

export async function removePasskey(passkeyId: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.deletePasskey(app, session, passkeyId, await requestOrigin()),
  );
}

export async function beginSettingPassword(): Promise<SettingsResult<PasswordPromptView>> {
  const app = daybook();
  const session = await requireSession(app);
  const prompt = await Settings.promptForNewPassword(app, session);
  if (!prompt.ok) {
    return prompt;
  }
  await setCeremonyCookie(prompt.value.ceremonyCookie);

  return ok(prompt.value.options);
}

export async function finishSettingPassword(key: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);
  const saved = await Settings.saveNewPassword(app, session, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    key,
    origin: await requestOrigin(),
  });
  await clearCeremonyCookie();

  return refreshOnSuccess(saved);
}

export async function endDevice(sessionId: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(await Settings.endDevice(app, session, sessionId, await requestOrigin()));
}

export async function endOtherDevices(): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(await Settings.endOtherDevices(app, session, await requestOrigin()));
}

export async function endPersonDevices(accountId: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.endPersonDevices(app, session, accountId, await requestOrigin()),
  );
}

// The link comes back once, for the page to show; only its hash is kept
export async function createInvite(): Promise<SettingsResult<Settings.IssuedLinkView>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.inviteSomeone(app, session, await requestOrigin(), appOrigin()),
  );
}

export async function createRecoveryLink(
  accountId: unknown,
): Promise<SettingsResult<Settings.IssuedLinkView>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(
    await Settings.recoveryLinkFor(app, session, accountId, await requestOrigin(), appOrigin()),
  );
}

export async function prepareStepUp(): Promise<
  SettingsResult<PublicKeyCredentialRequestOptionsJSON>
> {
  const app = daybook();
  const session = await requireSession(app);
  const prompt = await Settings.promptForStepUp(app, session, await requestOrigin());
  if (!prompt.ok) {
    return prompt;
  }
  await setCeremonyCookie(prompt.value.ceremonyCookie);

  return ok(prompt.value.options);
}

export async function completeStepUp(response: unknown): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);
  const fresh = await Settings.completeStepUp(app, session, {
    ceremonyCookie: await readCookie(ceremonyCookieName),
    response,
    origin: await requestOrigin(),
  });
  await clearCeremonyCookie();
  if (!fresh.ok) {
    return fresh;
  }
  await setSessionCookie(fresh.value);

  return ok(null);
}
