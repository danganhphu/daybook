import { env } from "cloudflare:workers";

import { createUnitOfWork } from "@/composition/unit-of-work";
import { parseCeremonyCookie } from "@/features/access/application/ceremony-cookie";
import {
  finishPasskeySetup,
  type FinishPasskeySetupRequest,
} from "@/features/access/application/finish-passkey-setup";
import {
  finishPasskeySignIn,
  type FinishPasskeySignInRequest,
} from "@/features/access/application/finish-passkey-sign-in";
import { startPasskeySetup } from "@/features/access/application/start-passkey-setup";
import {
  startPasskeySignIn,
  type StartPasskeySignInRequest,
} from "@/features/access/application/start-passkey-sign-in";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createCeremonyRepository } from "@/features/access/infrastructure/ceremony-repository";
import { createRateLimiter } from "@/features/access/infrastructure/d1-rate-limiter";
import { createPasskeyRepository } from "@/features/access/infrastructure/passkey-repository";
import { createSetupLinkRepository } from "@/features/access/infrastructure/setup-link-repository";
import {
  createSimpleWebAuthnVerifier,
  type RelyingParty,
} from "@/features/access/infrastructure/simple-webauthn-verifier";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { Clock } from "@/shared/application/clock";
import { createDatabase } from "@/shared/infrastructure/d1/database";

import { softwareAuthenticator } from "./authenticator";

// A made-up workers.dev host: the shape of the real one, which is never written into the repository
export const relyingParty: RelyingParty = {
  id: "daybook.example.workers.dev",
  origin: "https://daybook.example.workers.dev",
  name: "daybook",
};

// The ceremony a cookie names, for tests that forge the binding next to it
export function ceremonyIdIn(cookie: string) {
  const parsed = parseCeremonyCookie(cookie);
  if (parsed === undefined) {
    throw new Error(`Not a ceremony cookie: ${cookie}`);
  }

  return parsed.ceremonyId;
}

export function anAuthenticator() {
  return softwareAuthenticator({ origin: relyingParty.origin, rpId: relyingParty.id });
}

// The passkey use cases over the test's D1, wired the way the App will wire them once the sign-in screens exist
export function passkeyUseCases(clock: Clock) {
  const db = createDatabase(env.DB);
  const deps = {
    clock,
    secrets: webCryptoSecrets,
    ceremonies: createCeremonyRepository(db),
    accounts: createAccountRepository(db),
    passkeys: createPasskeyRepository(db),
    setupLinks: createSetupLinkRepository(db),
    rateLimiter: createRateLimiter(db),
    verifier: createSimpleWebAuthnVerifier(relyingParty),
    startUnitOfWork: () => createUnitOfWork(db),
  };

  return {
    startPasskeySetup: (ceremonyCookie: string | undefined) =>
      startPasskeySetup(deps, ceremonyCookie),
    finishPasskeySetup: (request: FinishPasskeySetupRequest) => finishPasskeySetup(deps, request),
    startPasskeySignIn: (request: StartPasskeySignInRequest) => startPasskeySignIn(deps, request),
    finishPasskeySignIn: (request: FinishPasskeySignInRequest) =>
      finishPasskeySignIn(deps, request),
  };
}
