import { buildPushPayload } from "@block65/webcrypto-web-push";

import type { PushOutcome, PushSender } from "@/features/notifications/application/push-sender";

// The VAPID key pair as the library takes it: the public key as an uncompressed P-256 point and the private key as
// the JWK `d`, both base64url. The subject says who sends (RFC 8292): the app's own address.
export type VapidKeys = {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
};

const sent: PushOutcome = { kind: "sent" };
const gone: PushOutcome = { kind: "gone" };
const tooManyRequests = 429;
const serverErrors = 500;

// Retry-After in seconds; the HTTP-date form is left to the queue's own backoff
function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");

  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
}

// 201 accepted; 404 and 410 the subscription is gone (RFC 8030, web.dev's push guide, Mozilla's autopush); 429 and
// server errors are worth another try; anything else will fail the same way again
function outcomeOf(response: Response): PushOutcome {
  if (response.ok) {
    return sent;
  }
  if (response.status === 404 || response.status === 410) {
    return gone;
  }
  if (response.status === tooManyRequests || response.status >= serverErrors) {
    return { kind: "retry", afterSeconds: retryAfter(response) };
  }

  return { kind: "refused", status: response.status };
}

// Encrypts each message for its browser (RFC 8291) and signs for the push service (RFC 8292), then posts it
export function createWebPushSender(vapid: VapidKeys, fetcher: typeof fetch = fetch): PushSender {
  return {
    async send(subscription, message, delivery) {
      const payload = await buildPushPayload(
        {
          data: message,
          options: {
            ttl: delivery.ttlSeconds,
            urgency: delivery.urgency,
            ...(delivery.topic === undefined ? {} : { topic: delivery.topic }),
          },
        },
        { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
        vapid,
      );

      let response: Response;
      try {
        response = await fetcher(subscription.endpoint, {
          method: payload.method,
          headers: payload.headers,
          body: payload.body,
        });
      } catch {
        return { kind: "retry", afterSeconds: undefined };
      }
      await response.body?.cancel();

      return outcomeOf(response);
    },
  };
}
