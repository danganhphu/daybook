import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import { telegramLinkAttempts } from "@/features/access/domain/access-policy";
import { secretTokenSchema } from "@/features/access/domain/secret";
import { deviceLabelSchema } from "@/features/access/domain/session";
import * as TelegramLinks from "@/features/access/domain/telegram-link";
import type {
  TelegramChatId,
  TelegramLink,
  TelegramName,
  TelegramUserId,
} from "@/features/access/domain/telegram-link";
import * as TelegramLinkCodes from "@/features/access/domain/telegram-link-code";
import type { TelegramLinkCodeRepository } from "@/features/access/domain/telegram-link-code-repository";
import type { TelegramLinkRepository } from "@/features/access/domain/telegram-link-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, TelegramLinkWrites } from "./access-writes";
import { telegramUserDetail } from "./enlist-telegram-unlink";
import { overLimit } from "./over-limit";
import type { RateLimiter } from "./rate-limiter";
import { hashSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

// What the access log says of a request from the bot: the chat has no address of the person's to record
export const telegramOrigin: RequestOrigin = {
  ip: undefined,
  deviceLabel: deviceLabelSchema.parse("Telegram"),
};

export type LinkTelegramDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly rateLimiter: RateLimiter;
  readonly telegramLinks: TelegramLinkRepository;
  readonly telegramLinkCodes: TelegramLinkCodeRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly telegramLinks: TelegramLinkWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type LinkTelegramInput = {
  // As the /start message carried it: untrusted
  readonly code: string;
  readonly user: { readonly id: TelegramUserId; readonly name: TelegramName };
  readonly chatId: TelegramChatId;
};

export type LinkTelegramError = Extract<
  AccessError,
  "telegram_link_unusable" | "telegram_user_taken" | "rate_limited"
>;

async function refused(
  deps: LinkTelegramDeps,
  accountId: AccountId,
  reason: "expired" | "taken",
): Promise<void> {
  const work = deps.startUnitOfWork();
  work.accessEvents.add(
    AccessEvents.record(
      "telegram_link_refused",
      { accountId, detail: { reason } },
      telegramOrigin,
      deps.clock(),
    ),
  );
  await work.commit();
}

// Spends a link code from the bot's /start: the Telegram user who sent it writes as the code's account from now on,
// replacing the Telegram user that account had. Used, expired and unknown codes answer the same; a code that matches
// nothing is not logged, as it concerns no account.
export async function linkTelegram(
  deps: LinkTelegramDeps,
  input: LinkTelegramInput,
): Promise<Result<TelegramLink, LinkTelegramError>> {
  const now = deps.clock();
  // Words that cannot be a code cost nothing, not even a count
  const presented = secretTokenSchema.safeParse(input.code);
  if (!presented.success) {
    return err("telegram_link_unusable");
  }
  const limit = { key: `telegram-link:${input.user.id}`, ...telegramLinkAttempts };
  if (await overLimit(deps, [limit], "telegram_link", telegramOrigin, now)) {
    return err("rate_limited");
  }

  const code = await deps.telegramLinkCodes.take(
    await hashSecretToken(deps.secrets, presented.data),
  );
  if (code === undefined) {
    return err("telegram_link_unusable");
  }
  if (TelegramLinkCodes.isExpired(code, now)) {
    await refused(deps, code.accountId, "expired");
    return err("telegram_link_unusable");
  }

  const holder = await deps.telegramLinks.findByTelegramUser(input.user.id);
  if (holder !== undefined && holder.accountId !== code.accountId) {
    await refused(deps, code.accountId, "taken");
    return err("telegram_user_taken");
  }

  const link = TelegramLinks.link(code.accountId, input.user, input.chatId, now);
  const work = deps.startUnitOfWork();
  work.telegramLinks.save(link);
  work.accessEvents.add(
    AccessEvents.record(
      "telegram_linked",
      { accountId: link.accountId, actorId: link.accountId, detail: telegramUserDetail(link) },
      telegramOrigin,
      now,
    ),
  );
  await work.commit();

  return ok(link);
}
