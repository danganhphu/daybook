import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { setupLinkAttempts } from "@/features/access/domain/access-policy";
import * as Ceremonies from "@/features/access/domain/ceremony";
import type { Ceremony } from "@/features/access/domain/ceremony";
import { secretTokenSchema, type SecretToken } from "@/features/access/domain/secret";
import * as SetupLinks from "@/features/access/domain/setup-link";
import type { SetupLinkPurpose } from "@/features/access/domain/setup-link";
import type { SetupLinkRepository } from "@/features/access/domain/setup-link-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, CeremonyWrites, SetupLinkWrites } from "./access-writes";
import { clientNetwork } from "./rate-limit-keys";
import type { RateLimiter } from "./rate-limiter";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type RedeemSetupLinkDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly rateLimiter: RateLimiter;
  readonly setupLinks: SetupLinkRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly setupLinks: SetupLinkWrites;
    readonly ceremonies: CeremonyWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type SetupGrant = {
  readonly ceremony: Ceremony;
  readonly purpose: SetupLinkPurpose;
  // For the browser's ceremony cookie; the ceremony keeps only its hash
  readonly binding: SecretToken;
};

// Turns a setup link into a setup ceremony bound to this browser. The token arrives untrusted, from the page.
export async function redeemSetupLink(
  deps: RedeemSetupLinkDeps,
  token: string,
  origin: RequestOrigin,
): Promise<Result<SetupGrant, Extract<AccessError, "setup_link_unusable" | "rate_limited">>> {
  const now = deps.clock();

  if (
    origin.ip !== undefined &&
    (await deps.rateLimiter.hit(
      `setup-link:${clientNetwork(origin.ip)}`,
      setupLinkAttempts.window,
      now,
    )) > setupLinkAttempts.limit
  ) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(
      AccessEvents.record("rate_limited", { detail: { on: "setup_link" } }, origin, now),
    );
    await work.commit();

    return err("rate_limited");
  }

  const presented = secretTokenSchema.safeParse(token);
  const link = presented.success
    ? await deps.setupLinks.findByTokenHash(await hashSecretToken(deps.secrets, presented.data))
    : undefined;
  const redeemed =
    link === undefined ? err("setup_link_unusable" as const) : SetupLinks.redeem(link, now);

  if (!redeemed.ok) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(
      AccessEvents.record("setup_link_refused", { accountId: link?.accountId }, origin, now),
    );
    await work.commit();

    return redeemed;
  }

  const binding = newSecretToken(deps.secrets);
  const ceremony = Ceremonies.startSetup(
    redeemed.value,
    await hashSecretToken(deps.secrets, binding),
    now,
  );

  // A second redemption racing this one is refused by the database (setup_link_redeemed_once) and throws
  const work = deps.startUnitOfWork();
  work.setupLinks.markRedeemed(redeemed.value);
  work.ceremonies.add(ceremony);
  work.accessEvents.add(
    AccessEvents.record(
      "setup_link_redeemed",
      { accountId: redeemed.value.accountId, detail: { purpose: redeemed.value.purpose } },
      origin,
      now,
    ),
  );
  await work.commit();

  return ok({ ceremony, purpose: redeemed.value.purpose, binding });
}
