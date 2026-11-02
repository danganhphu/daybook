import { Temporal } from "temporal-polyfill/implementation";

import { secretHashSchema } from "@/features/access/domain/secret";
import {
  telegramChatIdSchema,
  telegramNameSchema,
  telegramUserIdSchema,
  type TelegramLink,
} from "@/features/access/domain/telegram-link";
import {
  telegramLinkCodeIdSchema,
  type TelegramLinkCode,
} from "@/features/access/domain/telegram-link-code";
import { accountIdSchema } from "@/shared/domain/account-id";

import type { telegramLinkCodeTable } from "./telegram-link-code.table";
import type { telegramLinkTable } from "./telegram-link.table";

type TelegramLinkRow = typeof telegramLinkTable.$inferSelect;
type TelegramLinkCodeRow = typeof telegramLinkCodeTable.$inferSelect;

export function toTelegramLink(row: TelegramLinkRow): TelegramLink {
  return {
    accountId: accountIdSchema.parse(row.accountId),
    telegramUserId: telegramUserIdSchema.parse(row.telegramUserId),
    chatId: telegramChatIdSchema.parse(row.telegramChatId),
    telegramName: telegramNameSchema.parse(row.telegramName),
    linkedAt: Temporal.Instant.fromEpochMilliseconds(row.linkedAt),
  };
}

export function toTelegramLinkRow(link: TelegramLink): TelegramLinkRow {
  return {
    accountId: link.accountId,
    telegramUserId: link.telegramUserId,
    telegramChatId: link.chatId,
    telegramName: link.telegramName,
    linkedAt: link.linkedAt.epochMilliseconds,
  };
}

export function toTelegramLinkCode(row: TelegramLinkCodeRow): TelegramLinkCode {
  return {
    id: telegramLinkCodeIdSchema.parse(row.id),
    accountId: accountIdSchema.parse(row.accountId),
    codeHash: secretHashSchema.parse(row.codeHash),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    expiresAt: Temporal.Instant.fromEpochMilliseconds(row.expiresAt),
  };
}

export function toTelegramLinkCodeRow(code: TelegramLinkCode): TelegramLinkCodeRow {
  return {
    id: code.id,
    accountId: code.accountId,
    codeHash: code.codeHash,
    createdAt: code.createdAt.epochMilliseconds,
    expiresAt: code.expiresAt.epochMilliseconds,
  };
}
