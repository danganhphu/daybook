import type { AccountId } from "@/shared/domain/account-id";

import { digestKinds } from "./notification-preference";

// What was sent: a digest, or a notice about the account's sign-in
export const deliverySubjects = [...digestKinds, "notice"] as const;

export type DeliverySubject = (typeof deliverySubjects)[number];

// Where it goes: the list in the app, always, and the browsers with push on. The bot adds Telegram.
export const deliveryChannels = ["inbox", "push"] as const;

export type DeliveryChannel = (typeof deliveryChannels)[number];

// Claimed while being sent; sent; or nothing to send (a quiet morning, no device to reach)
export const deliveryStatuses = ["claimed", "sent", "skipped"] as const;

export type DeliveryStatus = (typeof deliveryStatuses)[number];

// A digest's day (YYYY-MM-DD, Vietnam) or a notice's access event id
export const deliveryRefMaxLength = 64;

// One delivery, the ledger's key: claimed before sending, so a retried cron or a redelivered job never sends twice
export type DeliveryKey = {
  readonly accountId: AccountId;
  readonly subject: DeliverySubject;
  readonly ref: string;
  readonly channel: DeliveryChannel;
};

// How long the ledger remembers, long past any retry, and the list keeps what it was told (Microsoft Teams keeps its
// activity feed 30 days)
export const deliveryRetentionDays = 30;
