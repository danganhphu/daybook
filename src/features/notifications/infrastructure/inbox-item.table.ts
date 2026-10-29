import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { deliveryRefMaxLength, deliverySubjects } from "@/features/notifications/domain/delivery";
import { inboxLimits } from "@/features/notifications/domain/inbox-item";
import { sqlNumber, sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// The list in the app: each notification a person was given, in its own words, kept as long as the ledger remembers.
// Written by the system, so no audit columns; the person only marks it read. Times are epoch milliseconds.
export const inboxItemTable = sqliteTable(
  "inbox_item",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    subject: text("subject", { enum: deliverySubjects }).notNull(),
    ref: text("ref").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    path: text("path").notNull(),
    createdAt: integer("created_at").notNull(),
    readAt: integer("read_at"),
  },
  (table) => [
    check("inbox_item_subject_known", sql`${table.subject} in (${sqlTextList(deliverySubjects)})`),
    check(
      "inbox_item_ref_present",
      sql`length(${table.ref}) between 1 and ${sqlNumber(deliveryRefMaxLength)}`,
    ),
    check(
      "inbox_item_title_present",
      sql`length(trim(${table.title})) between 1 and ${sqlNumber(inboxLimits.title)}`,
    ),
    check("inbox_item_body_length", sql`length(${table.body}) <= ${sqlNumber(inboxLimits.body)}`),
    check(
      "inbox_item_path_in_app",
      sql`${table.path} like '/%' and ${table.path} not like '//%' and length(${table.path}) <= ${sqlNumber(inboxLimits.path)}`,
    ),
    check(
      "inbox_item_read_after_created",
      sql`${table.readAt} is null or ${table.readAt} >= ${table.createdAt}`,
    ),
    uniqueIndex("inbox_item_once").on(table.accountId, table.subject, table.ref),
    index("inbox_item_by_account").on(table.accountId, table.createdAt),
    index("inbox_item_unread")
      .on(table.accountId)
      .where(sql`${table.readAt} is null`),
  ],
);
