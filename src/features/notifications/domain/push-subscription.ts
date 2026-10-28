import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { DeviceLabel, SessionId } from "@/features/access/domain/session";
import type { AccountId } from "@/shared/domain/account-id";
import { base64UrlSchema } from "@/shared/domain/base64url-schema";

// Read as a module: `import * as PushSubscriptions`

export const pushSubscriptionIdSchema = z.uuid().brand<"PushSubscriptionId">();

export type PushSubscriptionId = z.infer<typeof pushSubscriptionIdSchema>;

export const pushEndpointMaxLength = 2048;

// The push services' own domains. Mozilla calls its endpoint opaque and liable to change, and Chromium hands out a
// different host than its docs show, so a host is matched by the domain it sits under, never exactly. Apple's is added
// with the iPhone pass, once its documentation is read.
export const pushServiceDomains = ["googleapis.com", "google.com", "mozilla.com"] as const;

export const pushEndpointSchema = z
  .url({ protocol: /^https$/ })
  .max(pushEndpointMaxLength)
  .brand<"PushEndpoint">();

export type PushEndpoint = z.infer<typeof pushEndpointSchema>;

// The browser's key for encrypting to it (an uncompressed P-256 point) and its 16-byte secret (RFC 8291)
export const pushKeyByteLength = 65;
export const pushAuthByteLength = 16;

export const pushKeysSchema = z.object({
  p256dh: base64UrlSchema(pushKeyByteLength).brand<"PushKey">(),
  auth: base64UrlSchema(pushAuthByteLength).brand<"PushAuth">(),
});

export type PushKeys = z.infer<typeof pushKeysSchema>;

// The Worker posts to whatever address a browser gave it, so only a known push service's is kept (OWASP SSRF
// prevention: match the host against an allowlist). No credentials and no port: no push service uses them.
export function isKnownPushService(endpoint: PushEndpoint): boolean {
  const url = new URL(endpoint);

  return (
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    pushServiceDomains.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  );
}

// Where one browser receives notifications. It is sent to only while the session it belongs to runs, so signing a
// device out, from anywhere, silences it; when that session ends it sleeps, without one, until the same browser signs
// in again and hands it over.
export type PushSubscription = {
  readonly id: PushSubscriptionId;
  readonly accountId: AccountId;
  // Undefined while asleep
  readonly sessionId: SessionId | undefined;
  // A capability: whoever holds it and the keys can reach the browser. Never logged.
  readonly endpoint: PushEndpoint;
  readonly keys: PushKeys;
  readonly deviceLabel: DeviceLabel;
  readonly createdAt: Temporal.Instant;
  readonly lastSentAt: Temporal.Instant | undefined;
};

export type SubscribingSession = {
  readonly accountId: AccountId;
  readonly sessionId: SessionId;
  readonly deviceLabel: DeviceLabel;
};

export function create(
  session: SubscribingSession,
  endpoint: PushEndpoint,
  keys: PushKeys,
  at: Temporal.Instant,
): PushSubscription {
  return {
    id: pushSubscriptionIdSchema.parse(uuidv7()),
    ...session,
    endpoint,
    keys,
    createdAt: at,
    lastSentAt: undefined,
  };
}

// The same browser after a new sign-in: its session changed, its subscription did not. Keys can rotate.
export function rebind(
  subscription: PushSubscription,
  session: SubscribingSession,
  keys: PushKeys,
): PushSubscription {
  return { ...subscription, ...session, keys };
}

export function markSent(subscription: PushSubscription, at: Temporal.Instant): PushSubscription {
  return { ...subscription, lastSentAt: at };
}
