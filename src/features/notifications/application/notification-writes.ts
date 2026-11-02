import type { Temporal } from "temporal-polyfill/implementation";

import type { AccessLogPosition } from "@/features/access/domain/access-event-repository";
import type { InboxItem, InboxItemId } from "@/features/notifications/domain/inbox-item";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import type {
  PushSubscription,
  PushSubscriptionId,
} from "@/features/notifications/domain/push-subscription";
import type { AccountId } from "@/shared/domain/account-id";

// Queue changes on the current unit of work; nothing is stored until it commits

export type PushSubscriptionWrites = {
  add(subscription: PushSubscription): void;
  update(subscription: PushSubscription): void;
  // The moment of the last push only: a send takes a while, and a sign-in on that browser meanwhile may have moved the
  // subscription to its new session, which writing the whole row back would undo
  recordSent(id: PushSubscriptionId, at: Temporal.Instant): void;
  remove(id: PushSubscriptionId): void;
};

export type NotificationPreferenceWrites = {
  add(preference: NotificationPreference): void;
  update(preference: NotificationPreference): void;
};

export type NoticeCursorWrites = {
  save(position: AccessLogPosition): void;
};

export type InboxWrites = {
  // Kept once: the same person, subject and ref again adds nothing
  add(item: InboxItem): void;
  // Every unread item of the person's made up to that moment
  markRead(accountId: AccountId, upTo: Temporal.Instant, at: Temporal.Instant): void;
  forget(before: Temporal.Instant): void;
  // Gone for good, and only the person's own
  remove(accountId: AccountId, ids: ReadonlyArray<InboxItemId>): void;
  removeAll(accountId: AccountId): void;
};
