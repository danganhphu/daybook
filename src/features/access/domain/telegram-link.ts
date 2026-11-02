import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

// Read as a module: `import * as TelegramLinks`

// Telegram's ids have at most 52 significant bits (Bot API, User and Chat), so a number holds them exactly
export const telegramUserIdSchema = z.int().positive().brand<"TelegramUserId">();

export type TelegramUserId = z.infer<typeof telegramUserIdSchema>;

// Stored rather than taken from the user's id: the Bot API never says a private chat's id equals it
export const telegramChatIdSchema = z.int().brand<"TelegramChatId">();

export type TelegramChatId = z.infer<typeof telegramChatIdSchema>;

// Our own cap, for the line in Settings; Telegram documents none for a name
export const telegramNameMaxLength = 128;

export const telegramNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(telegramNameMaxLength)
  .brand<"TelegramName">();

export type TelegramName = z.infer<typeof telegramNameSchema>;

// Shown when a name is only spaces or invisible marks
const unnamed = "Telegram";

// Which Telegram user writes into the book as which account, and where the bot answers them. One each way.
export type TelegramLink = {
  readonly accountId: AccountId;
  readonly telegramUserId: TelegramUserId;
  readonly chatId: TelegramChatId;
  // As Telegram showed them when they linked, so Settings can say which Telegram it is
  readonly telegramName: TelegramName;
  readonly linkedAt: Temporal.Instant;
};

// "Lan Nguyễn": the first and last names Telegram gives, cut to fit
export function nameOf(firstName: string, lastName: string | undefined): TelegramName {
  const full = [firstName, lastName ?? ""].join(" ").replaceAll(/\s+/g, " ").trim();

  return telegramNameSchema.parse(full.slice(0, telegramNameMaxLength).trim() || unnamed);
}

export function link(
  accountId: AccountId,
  user: { readonly id: TelegramUserId; readonly name: TelegramName },
  chatId: TelegramChatId,
  now: Temporal.Instant,
): TelegramLink {
  return {
    accountId,
    telegramUserId: user.id,
    chatId,
    telegramName: user.name,
    linkedAt: now,
  };
}
