import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { passkeySignInAttempts } from "@/features/access/domain/access-policy";
import * as Ceremonies from "@/features/access/domain/ceremony";
import { challengeSchema } from "@/features/access/domain/ceremony";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites } from "./access-writes";
import { formatCeremonyCookie } from "./ceremony-cookie";
import type { PasskeyVerifier } from "./passkey-verifier";
import { clientNetwork } from "./rate-limit-keys";
import type { RateLimiter } from "./rate-limiter";
import { hashSecretToken, newRandomValue, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type StartPasskeySignInDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly rateLimiter: RateLimiter;
  readonly passkeys: PasskeyRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly ceremonies: CeremonyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type StartPasskeySignInRequest = {
  readonly origin: RequestOrigin;
  // A signed-in session asking to confirm it is still its owner, before a security setting
  readonly stepUp?: Session;
};

export type PasskeyPrompt = {
  readonly options: PublicKeyCredentialRequestOptionsJSON;
  // The ceremony cookie's value. The binding in it exists nowhere else.
  readonly ceremonyCookie: string;
};

// The prompt a sign-in screen holds ready before the tap. No username: the passkey says whose it is.
export async function startPasskeySignIn(
  deps: StartPasskeySignInDeps,
  request: StartPasskeySignInRequest,
): Promise<Result<PasskeyPrompt, Extract<AccessError, "rate_limited">>> {
  const now = deps.clock();
  const { ip } = request.origin;
  if (
    ip !== undefined &&
    (await deps.rateLimiter.hit(
      `passkey-sign-in:${clientNetwork(ip)}`,
      passkeySignInAttempts.window,
      now,
    )) > passkeySignInAttempts.limit
  ) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(
      AccessEvents.record(
        "rate_limited",
        { detail: { on: "passkey_sign_in" } },
        request.origin,
        now,
      ),
    );
    await work.commit();

    return err("rate_limited");
  }

  const binding = newSecretToken(deps.secrets);
  const challenge = challengeSchema.parse(newRandomValue(deps.secrets));
  const accountId = request.stepUp?.accountId;
  const ceremony = Ceremonies.startPasskeySignIn(
    await hashSecretToken(deps.secrets, binding),
    challenge,
    accountId,
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.removeExpired(now);
  work.ceremonies.add(ceremony);
  await work.commit();

  const allow = accountId === undefined ? [] : await deps.passkeys.listForAccount(accountId);

  return ok({
    options: await deps.verifier.requestOptions({
      challenge,
      allow: allow.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports })),
    }),
    ceremonyCookie: formatCeremonyCookie({ ceremonyId: ceremony.id, binding }),
  });
}
