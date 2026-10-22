import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import * as Passwords from "@/features/access/domain/password";
import { currentArgon2Parameters, derivedKeySchema } from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, PasswordWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import { verifierFor } from "./password-keys";
import type { Peppers } from "./peppers";
import type { Secrets } from "./secrets";

export type FinishPasswordChangeDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly peppers: Peppers;
  readonly ceremonies: CeremonyRepository;
  readonly passwords: PasswordRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly passwords: PasswordWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type FinishPasswordChangeRequest = {
  readonly ceremonyCookie: string | undefined;
  readonly key: unknown;
  readonly origin: RequestOrigin;
};

// Stores the new password's verifier. Step-up is checked again here: the browser that began may have waited.
// A changed password starts unlocked with no failures. The policy - length, the breach check - is the browser's:
// the server never sees the password, only what Argon2id made of it (ADR 0009, "Deviations").
export async function finishPasswordChange(
  deps: FinishPasswordChangeDeps,
  session: Session,
  request: FinishPasswordChangeRequest,
): Promise<Result<null, Extract<AccessError, "step_up_required" | "password_not_saved">>> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now)) {
    return err("step_up_required");
  }

  const ceremony = await findBoundCeremony(deps, request.ceremonyCookie, "password_change");
  const key = derivedKeySchema.safeParse(request.key);
  if (
    ceremony?.salt === undefined ||
    ceremony.accountId !== session.accountId ||
    Ceremonies.isExpired(ceremony, now) ||
    !key.success ||
    !(await deps.ceremonies.take(ceremony.id))
  ) {
    return err("password_not_saved");
  }

  const existing = await deps.passwords.get(session.accountId);
  const pepper = deps.peppers.current;
  const password = Passwords.set(
    {
      accountId: session.accountId,
      salt: ceremony.salt,
      parameters: currentArgon2Parameters,
      verifier: await verifierFor(deps.secrets, pepper, key.data),
      pepperVersion: pepper.version,
    },
    now,
  );

  const work = deps.startUnitOfWork();
  work.passwords.save(password);
  work.accessEvents.add(
    AccessEvents.record(
      existing === undefined ? "password_set" : "password_changed",
      { accountId: session.accountId, actorId: session.accountId, sessionId: session.id },
      request.origin,
      now,
    ),
  );
  await work.commit();

  return ok(null);
}
