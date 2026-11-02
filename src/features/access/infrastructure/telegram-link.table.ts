import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { telegramNameMaxLength } from "@/features/access/domain/telegram-link";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// One Telegram user per account and one account per Telegram user. Deleted on unlinking; access_event keeps the
// history. Times are epoch milliseconds.
export const telegramLinkTable = sqliteTable(
  "telegram_link",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accountTable.id),
    telegramUserId: integer("telegram_user_id").notNull().unique(),
    telegramChatId: integer("telegram_chat_id").notNull(),
    telegramName: text("telegram_name").notNull(),
    linkedAt: integer("linked_at").notNull(),
  },
  (table) => [
    check("telegram_link_user_id_positive", sql`${table.telegramUserId} > 0`),
    check(
      "telegram_link_name_length",
      sql`length(trim(${table.telegramName})) between 1 and ${sqlNumber(telegramNameMaxLength)}`,
    ),
  ],
);
