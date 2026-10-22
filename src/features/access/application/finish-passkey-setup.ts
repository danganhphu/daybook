import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import * as Passkeys from "@/features/access/domain/passkey";
import type { Passkey } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { SessionId } from "@/features/access/domain/session";
import type { SetupLinkRepository } from "@/features/access/domain/setup-link-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites, PasskeyWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import { enlistNewSession, type OpenedSession, type SessionStores } from "./enlist-new-session";
import type { PasskeyVerifier } from "./passkey-verifier";
import type { Secrets } from "./secrets";

export type FinishPasskeySetupDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
  readonly accounts: AccountRepository;
  readonly passkeys: PasskeyRepository;
  readonly setupLinks: SetupLinkRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<
    SessionStores & {
      readonly ceremonies: CeremonyWrites;
      readonly passkeys: PasskeyWrites;
      readonly accessEvents: AccessEventWrites;
    }
  >;
};

export type FinishPasskeySetupRequest = {
  readonly ceremonyCookie: string | undefined;
  // The browser's answer to the prompt, untrusted
  readonly response: unknown;
  readonly origin: RequestOrigin;
  readonly replacing: SessionId | undefined;
};

export type FinishedSetup = OpenedSession & { readonly passkey: Passkey };

// Stores the passkey a setup link was for and signs the person in with it. A recovery link also ends every other
// session of the account, since whoever held them may be the reason for the recovery.
export async function finishPasskeySetup(
  deps: FinishPasskeySetupDeps,
  request: FinishPasskeySetupRequest,
): Promise<
  Result<FinishedSetup, Extract<AccessError, "setup_link_unusable" | "passkey_not_accepted">>
> {
  const now = deps.clock();
  const setup = await findBoundCeremony(deps, request.ceremonyCookie, "setup");
  if (
    setup === undefined ||
    Ceremonies.isExpired(setup, now) ||
    setup.accountId === undefined ||
    setup.setupLinkId === undefined
  ) {
    return err("setup_link_unusable");
  }
  const accountId = setup.accountId;

  // No prompt is waiting, or another response to it got here first
  if (
    setup.challenge === undefined ||
    !(await deps.ceremonies.spendChallenge(setup.id, setup.challenge))
  ) {
    return err("passkey_not_accepted");
  }

  async function refuse(reason: string) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(
      AccessEvents.record(
        "sign_in_failed",
        { accountId, detail: { method: "passkey", step: "setup", reason } },
        request.origin,
        now,
      ),
    );
    await work.commit();

    return err("passkey_not_accepted" as const);
  }

  const verified = await deps.verifier.verifyRegistration(request.response, setup.challenge);
  if (!verified.ok) {
    return refuse(verified.error);
  }
  if ((await deps.passkeys.findByCredentialId(verified.value.credentialId)) !== undefined) {
    return refuse("already_registered");
  }

  const [account, link] = await Promise.all([
    deps.accounts.get(accountId),
    deps.setupLinks.get(setup.setupLinkId),
  ]);
  if (account === undefined || link === undefined) {
    return err("setup_link_unusable");
  }

  const passkey = Passkeys.register(
    { ...verified.value, accountId: account.id, name: request.origin.deviceLabel },
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.remove(setup.id);
  work.passkeys.add(passkey);
  work.accessEvents.add(
    AccessEvents.record(
      "passkey_added",
      {
        accountId: account.id,
        actorId: account.id,
        passkeyId: passkey.id,
        detail: { via: link.purpose },
      },
      request.origin,
      now,
    ),
  );
  if (link.purpose === "recovery") {
    work.sessions.removeAll(account.id);
    work.accessEvents.add(
      AccessEvents.record(
        "sessions_revoked",
        { accountId: account.id, actorId: account.id, detail: { via: "recovery" } },
        request.origin,
        now,
      ),
    );
  }
  const opened = await enlistNewSession(
    work,
    deps.secrets,
    {
      accountId: account.id,
      method: "passkey",
      passkeyId: passkey.id,
      origin: request.origin,
      replacing: request.replacing,
    },
    now,
  );
  await work.commit();

  return ok({ ...opened, passkey });
}
