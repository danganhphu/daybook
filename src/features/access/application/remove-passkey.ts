import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { passkeyIdSchema } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import * as Passwords from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, PasskeyWrites } from "./access-writes";

export type RemovePasskeyDeps = {
  readonly clock: Clock;
  readonly passkeys: PasskeyRepository;
  readonly passwords: PasswordRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly passkeys: PasskeyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// Removes a passkey of this account - a lost phone's, say - after a recent sign-in. Never the last way in: another
// passkey, or a password that is not locked, must remain (ADR 0009, decision 5).
export async function removePasskey(
  deps: RemovePasskeyDeps,
  session: Session,
  passkeyId: unknown,
  origin: RequestOrigin,
): Promise<Result<null, Extract<AccessError, "step_up_required" | "not_found" | "last_way_in">>> {
  const now = deps.clock();
  if (!Sessions.isFresh(session, now)) {
    return err("step_up_required");
  }

  const id = passkeyIdSchema.safeParse(passkeyId);
  const owned = await deps.passkeys.listForAccount(session.accountId);
  const target = id.success ? owned.find((passkey) => passkey.id === id.data) : undefined;
  if (target === undefined) {
    return err("not_found");
  }

  const password = await deps.passwords.get(session.accountId);
  const passwordWorks = password !== undefined && !Passwords.isLocked(password);
  if (owned.length === 1 && !passwordWorks) {
    return err("last_way_in");
  }

  const work = deps.startUnitOfWork();
  work.passkeys.remove(target.id);
  work.accessEvents.add(
    AccessEvents.record(
      "passkey_removed",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: session.id,
        passkeyId: target.id,
      },
      origin,
      now,
    ),
  );
  await work.commit();

  return ok(null);
}
