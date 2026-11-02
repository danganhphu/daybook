import type { AccountId } from "@/shared/domain/account-id";

import type { TelegramLink, TelegramUserId } from "./telegram-link";

// Reads only. Writes go through the application's unit of work.
export type TelegramLinkRepository = {
  get(accountId: AccountId): Promise<TelegramLink | undefined>;
  findByTelegramUser(telegramUserId: TelegramUserId): Promise<TelegramLink | undefined>;
};
