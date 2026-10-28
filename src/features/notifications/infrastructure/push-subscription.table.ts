import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { deviceLabelMaxLength } from "@/features/access/domain/session";
import { accountTable } from "@/features/access/infrastructure/account.table";
import { sessionTable } from "@/features/access/infrastructure/session.table";
import {
  pushAuthByteLength,
  pushEndpointMaxLength,
  pushKeyByteLength,
} from "@/features/notifications/domain/push-subscription";
import { base64UrlLength } from "@/shared/domain/base64url";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

// One per browser that turned notifications on. Its session ending leaves it asleep (no session, nothing sent), so
// every way of signing a device out silences it, and the same browser signing in again wakes the same row rather than
// counting as a new device. Times are epoch milliseconds.
export const pushSubscriptionTable = sqliteTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accountTable.id),
    sessionId: text("session_id")
      .unique()
      .references(() => sessionTable.id, { onDelete: "set null" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceLabel: text("device_label").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSentAt: integer("last_sent_at"),
  },
  (table) => [
    check(
      "push_subscription_endpoint_https",
      sql`${table.endpoint} like 'https://%' and length(${table.endpoint}) <= ${sqlNumber(pushEndpointMaxLength)}`,
    ),
    check(
      "push_subscription_key_lengths",
      sql`length(${table.p256dh}) = ${sqlNumber(base64UrlLength(pushKeyByteLength))} and length(${table.auth}) = ${sqlNumber(base64UrlLength(pushAuthByteLength))}`,
    ),
    check(
      "push_subscription_device_label_present",
      sql`length(trim(${table.deviceLabel})) between 1 and ${sqlNumber(deviceLabelMaxLength)}`,
    ),
    index("push_subscription_by_account").on(table.accountId),
  ],
);
