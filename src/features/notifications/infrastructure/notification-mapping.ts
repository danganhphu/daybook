import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { deviceLabelSchema, sessionIdSchema } from "@/features/access/domain/session";
import { deliverySubjects } from "@/features/notifications/domain/delivery";
import { inboxItemIdSchema, type InboxItem } from "@/features/notifications/domain/inbox-item";
import {
  quietAfterDaysSchema,
  timeOfDaySchema,
  type NotificationPreference,
} from "@/features/notifications/domain/notification-preference";
import {
  pushEndpointSchema,
  pushKeysSchema,
  pushSubscriptionIdSchema,
  type PushSubscription,
} from "@/features/notifications/domain/push-subscription";
import { accountIdSchema } from "@/shared/domain/account-id";
import { toAudit, toAuditRow } from "@/shared/infrastructure/d1/audit-mapping";

import type { inboxItemTable } from "./inbox-item.table";
import type { notificationPreferenceTable } from "./notification-preference.table";
import type { pushSubscriptionTable } from "./push-subscription.table";

type PushSubscriptionRow = typeof pushSubscriptionTable.$inferSelect;
type NotificationPreferenceRow = typeof notificationPreferenceTable.$inferSelect;
type InboxItemRow = typeof inboxItemTable.$inferSelect;

export function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    id: pushSubscriptionIdSchema.parse(row.id),
    accountId: accountIdSchema.parse(row.accountId),
    sessionId: row.sessionId === null ? undefined : sessionIdSchema.parse(row.sessionId),
    endpoint: pushEndpointSchema.parse(row.endpoint),
    keys: pushKeysSchema.parse({ p256dh: row.p256dh, auth: row.auth }),
    deviceLabel: deviceLabelSchema.parse(row.deviceLabel),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    lastSentAt:
      row.lastSentAt === null ? undefined : Temporal.Instant.fromEpochMilliseconds(row.lastSentAt),
  };
}

export function toPushSubscriptionRow(subscription: PushSubscription): PushSubscriptionRow {
  return {
    id: subscription.id,
    accountId: subscription.accountId,
    sessionId: subscription.sessionId ?? null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    deviceLabel: subscription.deviceLabel,
    createdAt: subscription.createdAt.epochMilliseconds,
    lastSentAt: subscription.lastSentAt?.epochMilliseconds ?? null,
  };
}

const optionalTime = (value: string | null) =>
  value === null ? undefined : timeOfDaySchema.parse(value);

export function toNotificationPreference(row: NotificationPreferenceRow): NotificationPreference {
  return {
    accountId: accountIdSchema.parse(row.accountId),
    morningAt: optionalTime(row.morningAt),
    weeklyAt: optionalTime(row.weeklyAt),
    quietAfterDays: quietAfterDaysSchema.parse(row.quietAfterDays),
    audit: toAudit(row),
  };
}

const subjectSchema = z.enum(deliverySubjects);

export function toInboxItem(row: InboxItemRow): InboxItem {
  return {
    id: inboxItemIdSchema.parse(row.id),
    accountId: accountIdSchema.parse(row.accountId),
    subject: subjectSchema.parse(row.subject),
    ref: row.ref,
    title: row.title,
    body: row.body,
    path: row.path,
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    readAt: row.readAt === null ? undefined : Temporal.Instant.fromEpochMilliseconds(row.readAt),
  };
}

export function toInboxItemRow(item: InboxItem): InboxItemRow {
  return {
    id: item.id,
    accountId: item.accountId,
    subject: item.subject,
    ref: item.ref,
    title: item.title,
    body: item.body,
    path: item.path,
    createdAt: item.createdAt.epochMilliseconds,
    readAt: item.readAt?.epochMilliseconds ?? null,
  };
}

// Only a saved preference has a row: one with no audit is the defaults, never written
export function toNotificationPreferenceRow(
  preference: NotificationPreference,
): NotificationPreferenceRow {
  if (preference.audit === undefined) {
    throw new Error("The default notification times are not stored");
  }

  return {
    accountId: preference.accountId,
    morningAt: preference.morningAt ?? null,
    weeklyAt: preference.weeklyAt ?? null,
    quietAfterDays: preference.quietAfterDays,
    ...toAuditRow(preference.audit),
  };
}
