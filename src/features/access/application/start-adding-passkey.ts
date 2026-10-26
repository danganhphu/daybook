import type { AccountRepository } from "@/features/access/domain/account-repository";
import * as Ceremonies from "@/features/access/domain/ceremony";
import { challengeSchema } from "@/features/access/domain/ceremony";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Session } from "@/features/access/domain/session";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { CeremonyWrites } from "./access-writes";
import { formatCeremonyCookie } from "./ceremony-cookie";
import type { PasskeyVerifier } from "./passkey-verifier";
import { hashSecretToken, newRandomValue, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type StartAddingPasskeyDeps = StepUpDeps & {
  readonly secrets: Secrets;
  readonly accounts: AccountRepository;
  readonly passkeys: PasskeyRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly ceremonies: CeremonyWrites }>;
};

// The prompt for another passkey on this account - a new phone, a laptop - after a recent sign-in. On an account that
// has a passkey that sign-in is a passkey's: a password alone cannot add one (ADR 0009, amended 2026-10-26).
export async function startAddingPasskey(
  deps: StartAddingPasskeyDeps,
  session: Session,
): Promise<
  Result<
    { readonly options: PublicKeyCredentialCreationOptionsJSON; readonly ceremonyCookie: string },
    Extract<AccessError, "step_up_required">
  >
> {
  const now = deps.clock();
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  const account = await deps.accounts.get(session.accountId);
  if (account === undefined) {
    throw new Error(
      `Session ${session.id} names account ${session.accountId}, which does not exist`,
    );
  }

  const binding = newSecretToken(deps.secrets);
  const challenge = challengeSchema.parse(newRandomValue(deps.secrets));
  const ceremony = Ceremonies.startPasskeyRegistration(
    await hashSecretToken(deps.secrets, binding),
    challenge,
    account.id,
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.removeExpired(now);
  work.ceremonies.add(ceremony);
  await work.commit();

  const existing = await deps.passkeys.listForAccount(account.id);

  return ok({
    options: await deps.verifier.creationOptions({
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
    ceremonyCookie: formatCeremonyCookie({ ceremonyId: ceremony.id, binding }),
  });
}
