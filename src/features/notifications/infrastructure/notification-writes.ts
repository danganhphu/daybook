import { and, eq, isNull, lt, lte } from "drizzle-orm";

import type {
  InboxWrites,
  NoticeCursorWrites,
  NotificationPreferenceWrites,
  PushSubscriptionWrites,
} from "@/features/notifications/application/notification-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { inboxItemTable } from "./inbox-item.table";
import { noticeCursorName, noticeCursorTable } from "./notice-cursor.table";
import {
  toInboxItemRow,
  toNotificationPreferenceRow,
  toPushSubscriptionRow,
} from "./notification-mapping";
import { notificationPreferenceTable } from "./notification-preference.table";
import { pushSubscriptionTable } from "./push-subscription.table";

export function createPushSubscriptionWrites(db: Database, batch: Batch): PushSubscriptionWrites {
  return {
    add(subscription) {
      batch.enlist(db.insert(pushSubscriptionTable).values(toPushSubscriptionRow(subscription)));
    },

    update(subscription) {
      const { id: _id, createdAt: _createdAt, ...changes } = toPushSubscriptionRow(subscription);
      batch.enlist(
        db
          .update(pushSubscriptionTable)
          .set(changes)
          .where(eq(pushSubscriptionTable.id, subscription.id)),
      );
    },

    remove(id) {
      batch.enlist(db.delete(pushSubscriptionTable).where(eq(pushSubscriptionTable.id, id)));
    },
  };
}

// Updates set everything but the creation, which the database refuses to change; the version trigger refuses a stale
// write
export function createNotificationPreferenceWrites(
  db: Database,
  batch: Batch,
): NotificationPreferenceWrites {
  return {
    add(preference) {
      batch.enlist(
        db.insert(notificationPreferenceTable).values(toNotificationPreferenceRow(preference)),
      );
    },

    update(preference) {
      const {
        accountId: _accountId,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toNotificationPreferenceRow(preference);
      batch.enlist(
        db
          .update(notificationPreferenceTable)
          .set(changes)
          .where(eq(notificationPreferenceTable.accountId, preference.accountId)),
      );
    },
  };
}

export function createNoticeCursorWrites(db: Database, batch: Batch): NoticeCursorWrites {
  return {
    save(position) {
      const row = {
        occurredAt: position.occurredAt.epochMilliseconds,
        eventId: position.id,
      };
      batch.enlist(
        db
          .insert(noticeCursorTable)
          .values({ name: noticeCursorName, ...row })
          .onConflictDoUpdate({ target: noticeCursorTable.name, set: row }),
      );
    },
  };
}

export function createInboxWrites(db: Database, batch: Batch): InboxWrites {
  return {
    add(item) {
      batch.enlist(
        db
          .insert(inboxItemTable)
          .values(toInboxItemRow(item))
          .onConflictDoNothing({
            target: [inboxItemTable.accountId, inboxItemTable.subject, inboxItemTable.ref],
          }),
      );
    },

    markRead(accountId, upTo, at) {
      batch.enlist(
        db
          .update(inboxItemTable)
          .set({ readAt: at.epochMilliseconds })
          .where(
            and(
              eq(inboxItemTable.accountId, accountId),
              isNull(inboxItemTable.readAt),
              lte(inboxItemTable.createdAt, upTo.epochMilliseconds),
            ),
          ),
      );
    },

    forget(before) {
      batch.enlist(
        db.delete(inboxItemTable).where(lt(inboxItemTable.createdAt, before.epochMilliseconds)),
      );
    },
  };
}
