import { eq, inArray } from "drizzle-orm";

import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toNotificationPreference } from "./notification-mapping";
import { notificationPreferenceTable } from "./notification-preference.table";

export function createNotificationPreferenceRepository(
  db: Database,
): NotificationPreferenceRepository {
  return {
    async get(accountId) {
      const [row] = await db
        .select()
        .from(notificationPreferenceTable)
        .where(eq(notificationPreferenceTable.accountId, accountId))
        .limit(1);

      return row === undefined ? undefined : toNotificationPreference(row);
    },

    // Two people share a book, so the ids always fit in one statement's parameters
    async getMany(accountIds) {
      if (accountIds.length === 0) {
        return new Map();
      }
      const rows = await db
        .select()
        .from(notificationPreferenceTable)
        .where(inArray(notificationPreferenceTable.accountId, [...accountIds]));

      return new Map(
        rows.map((row) => {
          const preference = toNotificationPreference(row);
          return [preference.accountId, preference] as const;
        }),
      );
    },
  };
}
