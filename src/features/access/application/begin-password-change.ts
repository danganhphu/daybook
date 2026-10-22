import * as Ceremonies from "@/features/access/domain/ceremony";
import { currentArgon2Parameters } from "@/features/access/domain/password";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { CeremonyWrites } from "./access-writes";
import type { PasswordPrompt } from "./begin-password-sign-in";
import { formatCeremonyCookie } from "./ceremony-cookie";
import { newPasswordSalt } from "./password-keys";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type BeginPasswordChangeDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly ceremonies: CeremonyWrites }>;
};

// A fresh salt for setting or changing the fallback password, after a recent sign-in (ADR 0009, decision 5)
export async function beginPasswordChange(
  deps: BeginPasswordChangeDeps,
  session: Session,
): Promise<Result<PasswordPrompt, Extract<AccessError, "step_up_required">>> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now)) {
    return err("step_up_required");
  }

  const salt = newPasswordSalt(deps.secrets);
  const binding = newSecretToken(deps.secrets);
  const ceremony = Ceremonies.startPasswordChange(
    await hashSecretToken(deps.secrets, binding),
    session.accountId,
    salt,
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.removeExpired(now);
  work.ceremonies.add(ceremony);
  await work.commit();

  return ok({
    salt,
    parameters: currentArgon2Parameters,
    ceremonyCookie: formatCeremonyCookie({ ceremonyId: ceremony.id, binding }),
  });
}
