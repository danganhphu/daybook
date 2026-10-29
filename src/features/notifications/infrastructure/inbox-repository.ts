import { and, count, desc, eq, isNull } from "drizzle-orm";

import type { InboxRepository } from "@/features/notifications/domain/inbox-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { inboxItemTable } from "./inbox-item.table";
import { toInboxItem } from "./notification-mapping";

export function createInboxRepository(db: Database): InboxRepository {
  return {
    async list(accountId, limit) {
      const rows = await db
        .select()
        .from(inboxItemTable)
        .where(eq(inboxItemTable.accountId, accountId))
        .orderBy(desc(inboxItemTable.createdAt), desc(inboxItemTable.id))
        .limit(limit);

      return rows.map(toInboxItem);
    },

    // Read from the partial index of unread items
    async unreadCount(accountId) {
      const [row] = await db
        .select({ unread: count() })
        .from(inboxItemTable)
        .where(and(eq(inboxItemTable.accountId, accountId), isNull(inboxItemTable.readAt)));

      return row?.unread ?? 0;
    },
  };
}
