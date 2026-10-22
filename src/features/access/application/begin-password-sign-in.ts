import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { passwordSignInAttempts } from "@/features/access/domain/access-policy";
import { usernameSchema } from "@/features/access/domain/account";
import * as Ceremonies from "@/features/access/domain/ceremony";
import {
  currentArgon2Parameters,
  type Argon2Parameters,
  type PasswordSalt,
} from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites } from "./access-writes";
import { formatCeremonyCookie } from "./ceremony-cookie";
import { decoySaltFor } from "./password-keys";
import type { Peppers } from "./peppers";
import { clientNetwork } from "./rate-limit-keys";
import type { RateLimiter } from "./rate-limiter";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type BeginPasswordSignInDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly peppers: Peppers;
  readonly rateLimiter: RateLimiter;
  readonly passwords: PasswordRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly ceremonies: CeremonyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// What the browser needs to turn the password into a key: the salt and the Argon2id cost
export type PasswordPrompt = {
  readonly salt: PasswordSalt;
  readonly parameters: Argon2Parameters;
  readonly ceremonyCookie: string;
};

// A long username is not a username; it only lengthens rate-limit keys
const usernameKeyLength = 64;

// The first half of a password sign-in. A username that exists, one with no password and one nobody has all get a
// salt the same way and take the same steps, so the answer tells a prober nothing (OWASP Authentication cheat sheet,
// "Authentication Responses"). Rate limited per client and per username before anything else.
export async function beginPasswordSignIn(
  deps: BeginPasswordSignInDeps,
  request: { readonly username: unknown; readonly origin: RequestOrigin },
): Promise<Result<PasswordPrompt, Extract<AccessError, "rate_limited">>> {
  const now = deps.clock();
  const typed = typeof request.username === "string" ? request.username.trim().toLowerCase() : "";
  const { ip } = request.origin;

  const limits = [
    ...(ip === undefined
      ? []
      : [{ key: `password:${clientNetwork(ip)}`, ...passwordSignInAttempts.perClient }]),
    {
      key: `password-user:${typed.slice(0, usernameKeyLength)}`,
      ...passwordSignInAttempts.perAccount,
    },
  ];
  const counts = await Promise.all(
    limits.map((limit) => deps.rateLimiter.hit(limit.key, limit.window, now)),
  );
  if (counts.some((count, index) => count > (limits[index]?.limit ?? 0))) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(
      AccessEvents.record(
        "rate_limited",
        { detail: { on: "password_sign_in" } },
        request.origin,
        now,
      ),
    );
    await work.commit();

    return err("rate_limited");
  }

  const username = usernameSchema.safeParse(typed);
  const found = username.success ? await deps.passwords.findForUsername(username.data) : undefined;
  const password = found?.password;
  // Made every time, used only without a password, so both paths do the same work
  const decoySalt = await decoySaltFor(deps.secrets, deps.peppers.current, typed);

  const binding = newSecretToken(deps.secrets);
  const ceremony = Ceremonies.startPasswordSignIn(
    await hashSecretToken(deps.secrets, binding),
    password?.accountId,
    now,
  );

  const work = deps.startUnitOfWork();
  work.ceremonies.removeExpired(now);
  work.ceremonies.add(ceremony);
  await work.commit();

  return ok({
    salt: password?.salt ?? decoySalt,
    parameters: password?.parameters ?? currentArgon2Parameters,
    ceremonyCookie: formatCeremonyCookie({ ceremonyId: ceremony.id, binding }),
  });
}
