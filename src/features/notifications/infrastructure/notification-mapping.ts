import { Temporal } from "temporal-polyfill/implementation";

import { deviceLabelSchema, sessionIdSchema } from "@/features/access/domain/session";
import {
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

import type { notificationPreferenceTable } from "./notification-preference.table";
import type { pushSubscriptionTable } from "./push-subscription.table";

type PushSubscriptionRow = typeof pushSubscriptionTable.$inferSelect;
type NotificationPreferenceRow = typeof notificationPreferenceTable.$inferSelect;

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
    audit: toAudit(row),
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
    ...toAuditRow(preference.audit),
  };
}
