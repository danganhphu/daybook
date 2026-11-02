import { eq } from "drizzle-orm";

import type { TelegramLinkRepository } from "@/features/access/domain/telegram-link-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toTelegramLink } from "./telegram-link-mapping";
import { telegramLinkTable } from "./telegram-link.table";

export function createTelegramLinkRepository(db: Database): TelegramLinkRepository {
  return {
    async get(accountId) {
      const [row] = await db
        .select()
        .from(telegramLinkTable)
        .where(eq(telegramLinkTable.accountId, accountId))
        .limit(1);

      return row === undefined ? undefined : toTelegramLink(row);
    },

    async findByTelegramUser(telegramUserId) {
      const [row] = await db
        .select()
        .from(telegramLinkTable)
        .where(eq(telegramLinkTable.telegramUserId, telegramUserId))
        .limit(1);

      return row === undefined ? undefined : toTelegramLink(row);
    },
  };
}
