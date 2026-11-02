import type { Temporal } from "temporal-polyfill/implementation";

import * as AccessEvents from "@/features/access/domain/access-event";
import type { AccessEventDetail, RequestOrigin } from "@/features/access/domain/access-event";
import type { SessionId } from "@/features/access/domain/session";
import type { TelegramLink } from "@/features/access/domain/telegram-link";
import type { AccountId } from "@/shared/domain/account-id";

import type { AccessEventWrites, TelegramLinkWrites } from "./access-writes";

// Which Telegram user it was, kept in the log since the link itself is deleted
export function telegramUserDetail(link: TelegramLink): AccessEventDetail {
  return { telegramUser: String(link.telegramUserId) };
}

// Unlinks an account's Telegram on the unit of work, with its event, when there is one. A lost phone's Telegram
// writes into the book as surely as its browser, so every way of signing a person out everywhere takes it too.
export function enlistTelegramUnlink(
  work: { readonly telegramLinks: TelegramLinkWrites; readonly accessEvents: AccessEventWrites },
  link: TelegramLink | undefined,
  by: {
    readonly actorId: AccountId;
    readonly sessionId?: SessionId | undefined;
    readonly detail?: AccessEventDetail | undefined;
  },
  origin: RequestOrigin,
  now: Temporal.Instant,
): void {
  if (link === undefined) {
    return;
  }

  work.telegramLinks.remove(link.accountId);
  work.accessEvents.add(
    AccessEvents.record(
      "telegram_unlinked",
      {
        accountId: link.accountId,
        actorId: by.actorId,
        sessionId: by.sessionId,
        detail: { ...by.detail, ...telegramUserDetail(link) },
      },
      origin,
      now,
    ),
  );
}
