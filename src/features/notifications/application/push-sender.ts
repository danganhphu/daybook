import type { PushSubscription } from "@/features/notifications/domain/push-subscription";

// What the service worker shows: the notification itself, already in words, and where a tap opens the app
export type PushMessage = {
  readonly title: string;
  readonly body: string;
  // A second message with the same tag replaces the first on the device, so a retried send never shows twice
  readonly tag: string;
  readonly path: string;
};

// How the push service treats it (RFC 8030): how long to hold it for a phone that is off, and an optional topic under
// which a newer message replaces one still waiting
export type PushDelivery = {
  readonly ttlSeconds: number;
  readonly topic: string | undefined;
};

export type PushOutcome =
  | { readonly kind: "sent" }
  // The browser dropped the subscription (404 or 410): delete it
  | { readonly kind: "gone" }
  // Busy or down (429, 5xx, no answer): try again later, after the service's Retry-After if it gave one
  | { readonly kind: "retry"; readonly afterSeconds: number | undefined }
  // Refused for good (a bad key, a payload too large): retrying cannot help
  | { readonly kind: "refused"; readonly status: number };

export type PushSender = {
  send(
    subscription: PushSubscription,
    message: PushMessage,
    delivery: PushDelivery,
  ): Promise<PushOutcome>;
};
