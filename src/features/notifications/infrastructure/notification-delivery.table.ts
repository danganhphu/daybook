import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import {
  deliveryChannels,
  deliveryRefMaxLength,
  deliveryStatuses,
  deliverySubjects,
} from "@/features/notifications/domain/delivery";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// The ledger: one row per delivery, claimed before anything is sent, so a repeated job sends nothing twice. Old rows are
// deleted by the scheduler. Times are epoch milliseconds.
export const notificationDeliveryTable = sqliteTable(
  "notification_delivery",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    subject: text("subject", { enum: deliverySubjects }).notNull(),
    ref: text("ref").notNull(),
    channel: text("channel", { enum: deliveryChannels }).notNull(),
    status: text("status", { enum: deliveryStatuses }).notNull(),
    attempts: integer("attempts").notNull(),
    claimedAt: integer("claimed_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (table) => [
    check(
      "notification_delivery_subject_known",
      sql`${table.subject} in (${sqlTextList(deliverySubjects)})`,
    ),
    check(
      "notification_delivery_channel_known",
      sql`${table.channel} in (${sqlTextList(deliveryChannels)})`,
    ),
    check(
      "notification_delivery_status_known",
      sql`${table.status} in (${sqlTextList(deliveryStatuses)})`,
    ),
    check(
      "notification_delivery_ref_present",
      sql`length(${table.ref}) between 1 and ${sqlNumber(deliveryRefMaxLength)}`,
    ),
    check("notification_delivery_attempts_positive", sql`${table.attempts} >= 1`),
    check(
      "notification_delivery_finished_when_not_claimed",
      sql`(${table.status} = 'claimed') = (${table.finishedAt} is null)`,
    ),
    uniqueIndex("notification_delivery_once").on(
      table.accountId,
      table.subject,
      table.ref,
      table.channel,
    ),
    index("notification_delivery_by_claim").on(table.claimedAt),
  ],
);
