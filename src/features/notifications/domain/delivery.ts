import type { AccountId } from "@/shared/domain/account-id";

import { digestKinds } from "./notification-preference";

// What was sent: a digest, a notice about the account's sign-in, or word that the bot could not answer a message
export const deliverySubjects = [...digestKinds, "notice", "reply_failed"] as const;

export type DeliverySubject = (typeof deliverySubjects)[number];

// Where it goes: the list in the app, always; the browsers with push on; the linked Telegram chat, unless turned off
export const deliveryChannels = ["inbox", "push", "telegram"] as const;

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
