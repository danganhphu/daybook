import { eq } from "drizzle-orm";

import type { TelegramLinkCodeRepository } from "@/features/access/domain/telegram-link-code-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { telegramLinkCodeTable } from "./telegram-link-code.table";
import { toTelegramLinkCode } from "./telegram-link-mapping";

export function createTelegramLinkCodeRepository(db: Database): TelegramLinkCodeRepository {
  return {
    async take(codeHash) {
      const [row] = await db
        .delete(telegramLinkCodeTable)
        .where(eq(telegramLinkCodeTable.codeHash, codeHash))
        .returning();

      return row === undefined ? undefined : toTelegramLinkCode(row);
    },
  };
}
