import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import * as Passkeys from "@/features/access/domain/passkey";
import type { Passkey } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Session } from "@/features/access/domain/session";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites, PasskeyWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import type { PasskeyVerifier } from "./passkey-verifier";
import type { Secrets } from "./secrets";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type FinishAddingPasskeyDeps = StepUpDeps & {
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
  readonly passkeys: PasskeyRepository;
  readonly verifier: PasskeyVerifier;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly ceremonies: CeremonyWrites;
    readonly passkeys: PasskeyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type FinishAddingPasskeyRequest = {
  readonly ceremonyCookie: string | undefined;
  readonly response: unknown;
  readonly origin: RequestOrigin;
};

// Stores the new passkey. Step-up is checked again: the prompt may have waited past the window.
export async function finishAddingPasskey(
  deps: FinishAddingPasskeyDeps,
  session: Session,
  request: FinishAddingPasskeyRequest,
): Promise<Result<Passkey, Extract<AccessError, "step_up_required" | "passkey_not_accepted">>> {
  const now = deps.clock();
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  const ceremony = await findBoundCeremony(deps, request.ceremonyCookie, "passkey_registration");
  if (
    ceremony?.challenge === undefined ||
    ceremony.accountId !== session.accountId ||
    !(await deps.ceremonies.spendChallenge(ceremony.id, ceremony.challenge))
  ) {
    return err("passkey_not_accepted");
  }
  const { id: ceremonyId, challenge } = ceremony;

  async function refuse(reason: string) {
    const work = deps.startUnitOfWork();
    work.ceremonies.remove(ceremonyId);
    work.accessEvents.add(
      AccessEvents.record(
        "sign_in_failed",
        {
          accountId: session.accountId,
          actorId: session.accountId,
          sessionId: session.id,
          detail: { method: "passkey", step: "add_passkey", reason },
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
  const verified = await deps.verifier.verifyRegistration(request.response, challenge);
  if (!verified.ok) {
    return refuse(verified.error);
  }
  if ((await deps.passkeys.findByCredentialId(verified.value.credentialId)) !== undefined) {
    return refuse("already_registered");
  }

  const passkey = Passkeys.register(
    { ...verified.value, accountId: session.accountId, name: request.origin.deviceLabel },
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.remove(ceremonyId);
  work.passkeys.add(passkey);
  work.accessEvents.add(
    AccessEvents.record(
      "passkey_added",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: session.id,
        passkeyId: passkey.id,
        detail: { via: "settings" },
      },
      request.origin,
      now,
    ),
  );
  await work.commit();

  return ok(passkey);
}
