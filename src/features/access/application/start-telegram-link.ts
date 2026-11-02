import type { Temporal } from "temporal-polyfill/implementation";

import type { SecretToken } from "@/features/access/domain/secret";
import type { Session } from "@/features/access/domain/session";
import * as TelegramLinkCodes from "@/features/access/domain/telegram-link-code";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { TelegramLinkCodeWrites } from "./access-writes";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type StartTelegramLinkDeps = StepUpDeps & {
  readonly secrets: Secrets;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly telegramLinkCodes: TelegramLinkCodeWrites;
  }>;
};

export type StartedTelegramLink = {
  // For the t.me link's start parameter, handed out once: 43 base64url characters, inside the 64 of A-Z, a-z, 0-9,
  // _ and - Telegram allows there (Bot API, deep linking). Only its hash is stored.
  readonly code: SecretToken;
  readonly expiresAt: Temporal.Instant;
};

// A security setting: once linked, a Telegram user writes into the book as this account. So it needs a recent
// sign-in, and what it hands out is a one-time code, the account's only one.
export async function startTelegramLink(
  deps: StartTelegramLinkDeps,
  session: Session,
): Promise<Result<StartedTelegramLink, Extract<AccessError, "step_up_required">>> {
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }

  const now = deps.clock();
  const code = newSecretToken(deps.secrets);
  const issued = TelegramLinkCodes.issue(
    session.accountId,
    await hashSecretToken(deps.secrets, code),
    now,
  );

  const work = deps.startUnitOfWork();
  work.telegramLinkCodes.removeExpired(now);
  work.telegramLinkCodes.removeForAccount(session.accountId);
  work.telegramLinkCodes.add(issued);
  await work.commit();

  return ok({ code, expiresAt: issued.expiresAt });
}
