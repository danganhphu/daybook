import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import * as Passkeys from "@/features/access/domain/passkey";
import type { Passkey } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites, PasskeyWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import { enlistNewSession, type OpenedSession, type SessionStores } from "./enlist-new-session";
import type { PasskeyVerifier } from "./passkey-verifier";
import type { Secrets } from "./secrets";

export type FinishPasskeySignInDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
  readonly accounts: AccountRepository;
  readonly passkeys: PasskeyRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<
    SessionStores & {
      readonly ceremonies: CeremonyWrites;
      readonly passkeys: PasskeyWrites;
      readonly accessEvents: AccessEventWrites;
    }
  >;
};

export type FinishPasskeySignInRequest = {
  readonly ceremonyCookie: string | undefined;
  // The browser's answer to the prompt, untrusted
  readonly response: unknown;
  readonly origin: RequestOrigin;
  // The session this browser already has, if any. It is replaced; for a step-up, by a fresh one.
  readonly current: Session | undefined;
};

// Checks a passkey's answer to a sign-in prompt and opens a session for its account. Every refusal looks the same
// to the browser; the access log keeps the reason. The prompt is spent whatever the outcome.
export async function finishPasskeySignIn(
  deps: FinishPasskeySignInDeps,
  request: FinishPasskeySignInRequest,
): Promise<Result<OpenedSession, Extract<AccessError, "passkey_not_accepted">>> {
  const now = deps.clock();
  const ceremony = await findBoundCeremony(deps, request.ceremonyCookie, "passkey_sign_in");
  // Nothing is logged for a request that never held a prompt: there is no attempt to record, and an append-only log
  // must not grow for whoever sends junk
  if (ceremony?.challenge === undefined) {
    return err("passkey_not_accepted");
  }
  const { id: ceremonyId, challenge } = ceremony;

  if (!(await deps.ceremonies.spendChallenge(ceremonyId, challenge))) {
    return err("passkey_not_accepted");
  }

  async function refuse(reason: string, passkey?: Passkey) {
    const work = deps.startUnitOfWork();
    work.ceremonies.remove(ceremonyId);
    work.accessEvents.add(
      AccessEvents.record(
        "sign_in_failed",
        {
          accountId: passkey?.accountId,
          passkeyId: passkey?.id,
          detail: { method: "passkey", reason },
        },
        request.origin,
        now,
      ),
    );
    await work.commit();

    return err("passkey_not_accepted" as const);
  }

  if (Ceremonies.isExpired(ceremony, now)) {
    return refuse("expired");
  }

  const presented = deps.verifier.readAssertion(request.response);
  if (presented === undefined) {
    return refuse("malformed");
  }

  const passkey = await deps.passkeys.findByCredentialId(presented.credentialId);
  if (passkey === undefined) {
    return refuse("unknown_credential");
  }

  const account = await deps.accounts.get(passkey.accountId);
  // The authenticator's user handle must name the account the credential is stored under
  if (
    account === undefined ||
    (presented.userHandle !== undefined && presented.userHandle !== account.userHandle)
  ) {
    return refuse("user_handle", passkey);
  }
  // A step-up confirms the account that asked for it, not whichever passkey happens to answer
  if (ceremony.accountId !== undefined && ceremony.accountId !== passkey.accountId) {
    return refuse("other_account", passkey);
  }

  const verified = await deps.verifier.verifyAssertion(request.response, challenge, passkey);
  if (!verified.ok) {
    return refuse(verified.error, passkey);
  }

  const used = Passkeys.recordUse(passkey, verified.value, now);

  const work = deps.startUnitOfWork();
  work.ceremonies.remove(ceremony.id);
  work.passkeys.recordUse(used.passkey);
  const opened = await enlistNewSession(
    work,
    deps.secrets,
    {
      accountId: passkey.accountId,
      method: "passkey",
      passkeyId: passkey.id,
      origin: request.origin,
      replacing: request.current?.id,
      ...(used.counterStalled ? { signals: { counter: "stalled" } } : {}),
    },
    now,
  );
  await work.commit();

  return ok(opened);
}
