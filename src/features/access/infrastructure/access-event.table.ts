import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accessEventKinds } from "@/features/access/domain/access-event";
import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

import { accountTable } from "./account.table";

// Append-only, like capture: the migration adds triggers that refuse UPDATE and DELETE. Sessions and passkeys are
// deleted, so their ids here are plain text, not foreign keys. Times are epoch milliseconds.
export const accessEventTable = sqliteTable(
  "access_event",
  {
    id: text("id").primaryKey(),
    occurredAt: integer("occurred_at").notNull(),
    kind: text("kind", { enum: accessEventKinds }).notNull(),
    accountId: text("account_id").references(() => accountTable.id),
    actorId: text("actor_id").references(() => accountTable.id),
    sessionId: text("session_id"),
    passkeyId: text("passkey_id"),
    ip: text("ip"),
    deviceLabel: text("device_label").notNull(),
    detail: text("detail"),
  },
  (table) => [
    check("access_event_kind_known", sql`${table.kind} in (${sqlTextList(accessEventKinds)})`),
    check(
      "access_event_detail_object",
      sql`${table.detail} is null or (json_valid(${table.detail}) and json_type(${table.detail}) = 'object')`,
    ),
    index("access_event_by_account").on(table.accountId, table.occurredAt),
    // The notices' relay reads the log in this order
    index("access_event_by_time").on(table.occurredAt, table.id),
  ],
);
