import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Ceremonies from "@/features/access/domain/ceremony";
import { challengeSchema } from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { CeremonyWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import type { PasskeyVerifier } from "./passkey-verifier";
import { newRandomValue } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type StartPasskeySetupDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
  readonly accounts: AccountRepository;
  readonly passkeys: PasskeyRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly ceremonies: CeremonyWrites }>;
};

// The passkey prompt for a redeemed setup link. Each call gives the setup a new challenge, so a prompt the person
// cancelled can be asked for again until the setup itself expires.
export async function startPasskeySetup(
  deps: StartPasskeySetupDeps,
  ceremonyCookie: string | undefined,
): Promise<
  Result<PublicKeyCredentialCreationOptionsJSON, Extract<AccessError, "setup_link_unusable">>
> {
  const now = deps.clock();
  const setup = await findBoundCeremony(deps, ceremonyCookie, "setup");
  // An invite has no account until the newcomer names it, which arrives with the people settings
  if (setup === undefined || Ceremonies.isExpired(setup, now) || setup.accountId === undefined) {
    return err("setup_link_unusable");
  }

  const account = await deps.accounts.get(setup.accountId);
  if (account === undefined) {
    return err("setup_link_unusable");
  }

  const challenge = challengeSchema.parse(newRandomValue(deps.secrets));
  const work = deps.startUnitOfWork();
  work.ceremonies.setChallenge(setup.id, challenge);
  await work.commit();

  const existing = await deps.passkeys.listForAccount(account.id);

  return ok(
    await deps.verifier.creationOptions({
      challenge,
      user: {
        handle: account.userHandle,
        name: account.username,
        displayName: account.displayName,
      },
      exclude: existing.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
    }),
  );
}
