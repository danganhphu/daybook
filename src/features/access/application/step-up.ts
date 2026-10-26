import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";

export type StepUpDeps = {
  readonly clock: Clock;
  readonly passkeys: PasskeyRepository;
};

// The check every security setting makes in its use case. The account's passkeys are read only for a recent password
// sign-in, the one case where they decide.
export async function isSteppedUp(deps: StepUpDeps, session: Session): Promise<boolean> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now) || session.method === "passkey") {
    return Sessions.isSteppedUp(session, now, true);
  }

  const passkeys = await deps.passkeys.listForAccount(session.accountId);

  return Sessions.isSteppedUp(session, now, passkeys.length > 0);
}
