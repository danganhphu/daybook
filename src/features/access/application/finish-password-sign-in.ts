import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import * as Passwords from "@/features/access/domain/password";
import { derivedKeySchema } from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Session } from "@/features/access/domain/session";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { accountIdSchema } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, PasswordWrites } from "./access-writes";
import { findBoundCeremony } from "./bound-ceremony";
import { enlistNewSession, type OpenedSession, type SessionStores } from "./enlist-new-session";
import { keyMatches, unmatchableVerifier } from "./password-keys";
import type { Peppers } from "./peppers";
import type { Secrets } from "./secrets";

export type FinishPasswordSignInDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly peppers: Peppers;
  readonly ceremonies: CeremonyRepository;
  readonly passwords: PasswordRepository;
  readonly startUnitOfWork: () => UnitOfWork<
    SessionStores & {
      readonly passwords: PasswordWrites;
      readonly accessEvents: AccessEventWrites;
    }
  >;
};

export type FinishPasswordSignInRequest = {
  readonly ceremonyCookie: string | undefined;
  // What the browser derived from the password with the salt it was given, untrusted
  readonly key: unknown;
  readonly origin: RequestOrigin;
  readonly current: Session | undefined;
};

// Looked up when the username matched nobody, so that path reads the table like any other
const nobody = accountIdSchema.parse("00000000-0000-7000-8000-000000000000");

// The second half: checks the key against the stored verifier and opens a session. A wrong key, a username that
// matched nobody and a locked password all get the same answer after the same work; only the log tells them apart.
export async function finishPasswordSignIn(
  deps: FinishPasswordSignInDeps,
  request: FinishPasswordSignInRequest,
): Promise<Result<OpenedSession, Extract<AccessError, "password_not_accepted">>> {
  const now = deps.clock();
  const ceremony = await findBoundCeremony(deps, request.ceremonyCookie, "password_sign_in");
  // No sign-in of this browser behind it, or another request already took it: nothing to record
  if (ceremony === undefined || !(await deps.ceremonies.take(ceremony.id))) {
    return err("password_not_accepted");
  }

  async function refuse(
    reason: string,
    writes?: (work: {
      readonly passwords: PasswordWrites;
      readonly accessEvents: AccessEventWrites;
    }) => void,
  ) {
    const work = deps.startUnitOfWork();
    writes?.(work);
    work.accessEvents.add(
      AccessEvents.record(
        "sign_in_failed",
        { accountId: ceremony?.accountId, detail: { method: "password", reason } },
        request.origin,
        now,
      ),
    );
    await work.commit();

    return err("password_not_accepted" as const);
  }

  const key = derivedKeySchema.safeParse(request.key);
  if (Ceremonies.isExpired(ceremony, now) || !key.success) {
    return refuse(key.success ? "expired" : "malformed");
  }

  const password = await deps.passwords.get(ceremony.accountId ?? nobody);
  const pepper =
    password === undefined ? deps.peppers.current : deps.peppers.byVersion(password.pepperVersion);
  if (pepper === undefined) {
    throw new Error(
      `Password of ${password?.accountId} needs pepper ${password?.pepperVersion}, which is gone`,
    );
  }
  const matches = await keyMatches(
    deps.secrets,
    pepper,
    key.data,
    password?.verifier ?? unmatchableVerifier,
  );

  if (password === undefined) {
    return refuse("no_password");
  }
  if (Passwords.isLocked(password)) {
    return refuse("locked");
  }
  if (!matches) {
    // The count is the database's; this read only decides whether the lock is logged, so two guesses at once that
    // cross the line together log it twice, or not at all - the lock itself holds either way
    const failed = Passwords.recordFailure(password, now);

    return refuse("wrong_password", (work) => {
      work.passwords.recordFailure(password.accountId, now);
      if (Passwords.isLocked(failed)) {
        work.accessEvents.add(
          AccessEvents.record(
            "password_locked",
            { accountId: password.accountId },
            request.origin,
            now,
          ),
        );
      }
    });
  }

  const work = deps.startUnitOfWork();
  work.passwords.recordAttempt(Passwords.recordSuccess(password));
  const opened = await enlistNewSession(
    work,
    deps.secrets,
    {
      accountId: password.accountId,
      method: "password",
      passkeyId: undefined,
      origin: request.origin,
      replacing: request.current?.id,
    },
    now,
  );
  await work.commit();

  return ok(opened);
}
