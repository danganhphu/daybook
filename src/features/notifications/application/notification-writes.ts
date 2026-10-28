import type { AccessLogPosition } from "@/features/access/domain/access-event-repository";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import type {
  PushSubscription,
  PushSubscriptionId,
} from "@/features/notifications/domain/push-subscription";

// Queue changes on the current unit of work; nothing is stored until it commits

export type PushSubscriptionWrites = {
  add(subscription: PushSubscription): void;
  update(subscription: PushSubscription): void;
  remove(id: PushSubscriptionId): void;
};

export type NotificationPreferenceWrites = {
  add(preference: NotificationPreference): void;
  update(preference: NotificationPreference): void;
};

export type NoticeCursorWrites = {
  save(position: AccessLogPosition): void;
};
