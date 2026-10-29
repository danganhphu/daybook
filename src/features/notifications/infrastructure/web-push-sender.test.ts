import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { deviceLabelSchema } from "@/features/access/domain/session";
import type { PushMessage } from "@/features/notifications/application/push-sender";
import {
  pushEndpointSchema,
  pushKeysSchema,
  pushSubscriptionIdSchema,
  type PushSubscription,
} from "@/features/notifications/domain/push-subscription";
import { decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";
import { anAuthorId } from "@/testing/support/app";

import { newVapidKeys } from "./vapid-keys";
import { createWebPushSender } from "./web-push-sender";

// A browser of the test's own: its ECDH key pair and auth secret, so what is sent to it can be opened
async function aBrowser() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const subscription: PushSubscription = {
    id: pushSubscriptionIdSchema.parse(crypto.randomUUID()),
    accountId: anAuthorId,
    sessionId: undefined,
    endpoint: pushEndpointSchema.parse("https://fcm.googleapis.com/fcm/send/abc"),
    keys: pushKeysSchema.parse({ p256dh: encodeBase64Url(publicKey), auth: encodeBase64Url(auth) }),
    deviceLabel: deviceLabelSchema.parse("Chrome trên Android"),
    createdAt: Temporal.Instant.from("2026-10-28T01:00:00Z"),
    lastSentAt: undefined,
  };

  return { privateKey: pair.privateKey, publicKey, auth, subscription };
}

function join(...parts: ReadonlyArray<Uint8Array>): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return joined;
}

const text = (value: string) => new TextEncoder().encode(value);

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  secret: ArrayBuffer,
  info: Uint8Array<ArrayBuffer>,
  bits: number,
) {
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bits);
}

// RFC 8291, section 3, from the browser's side: the header, the shared secret, the content key and nonce, then the
// padded record
async function openAsBrowser(
  body: Uint8Array<ArrayBuffer>,
  browser: { privateKey: CryptoKey; publicKey: Uint8Array; auth: Uint8Array<ArrayBuffer> },
): Promise<string> {
  const salt = body.slice(0, 16);
  const keyLength = body[20] ?? 0;
  const serverKey = body.slice(21, 21 + keyLength);
  const record = body.slice(21 + keyLength);
  const server = await crypto.subtle.importKey(
    "raw",
    serverKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: server },
    browser.privateKey,
    256,
  );
  const ikm = await hkdf(
    browser.auth,
    shared,
    join(text("WebPush: info\0"), browser.publicKey, serverKey),
    256,
  );
  const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 96);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, record),
  );

  return new TextDecoder().decode(padded.slice(0, padded.lastIndexOf(2)));
}

// Another secret than the one it was sealed for: AES-GCM's tag refuses it, whatever words the runtime gives
async function opens(
  body: Uint8Array<ArrayBuffer>,
  browser: Parameters<typeof openAsBrowser>[1],
): Promise<boolean> {
  try {
    await openAsBrowser(body, browser);
    return true;
  } catch {
    return false;
  }
}

const message: PushMessage = {
  title: "Hôm nay có 2 việc",
  body: "giao 2 hộp thuốc tê",
  tag: "morning-2026-10-29",
  path: "/reminders",
};

async function sendOnce(answer: Response) {
  const vapid = { ...(await newVapidKeys()), subject: "https://daybook.example.workers.dev" };
  const browser = await aBrowser();
  const requests: Request[] = [];
  const sender = createWebPushSender(vapid, async (input, init) => {
    requests.push(new Request(input, init));
    return answer;
  });
  const outcome = await sender.send(browser.subscription, message, {
    ttlSeconds: 43_200,
    topic: "morning-20261029",
    urgency: "high",
  });

  return { vapid, browser, request: requests[0], outcome };
}

describe("createWebPushSender", () => {
  it("given a message, when sent, then only the browser's keys open it, and it reads back whole", async () => {
    const { browser, request } = await sendOnce(new Response(null, { status: 201 }));
    const body = new Uint8Array(await (request?.arrayBuffer() ?? new ArrayBuffer(0)));

    expect(JSON.parse(await openAsBrowser(body, browser))).toEqual(message);
    expect(
      await opens(body, { ...browser, auth: crypto.getRandomValues(new Uint8Array(16)) }),
    ).toBe(false);
  });

  it("given a message, when sent, then the request carries RFC 8030's headers and a VAPID token the public key verifies, for this push service", async () => {
    const { vapid, request } = await sendOnce(new Response(null, { status: 201 }));
    const headers = request?.headers;
    const authorization = headers?.get("authorization") ?? "";
    const [, token = "", key = ""] = /^vapid t=([^,]+), k=(.+)$/.exec(authorization) ?? [];
    const [header = "", claims = "", signature = ""] = token.split(".");
    const publicKey = await crypto.subtle.importKey(
      "raw",
      decodeBase64Url(key),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const decoded = JSON.parse(new TextDecoder().decode(decodeBase64Url(claims)));

    expect(request?.url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(headers?.get("ttl")).toBe("43200");
    expect(headers?.get("topic")).toBe("morning-20261029");
    expect(headers?.get("urgency")).toBe("high");
    expect(headers?.get("content-encoding")).toBe("aes128gcm");
    expect(key).toBe(vapid.publicKey);
    expect(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        decodeBase64Url(signature),
        text(`${header}.${claims}`),
      ),
    ).toBe(true);
    expect(decoded).toMatchObject({ aud: "https://fcm.googleapis.com", sub: vapid.subject });
    expect(decoded.exp - Date.now() / 1000).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it.each([
    [201, { kind: "sent" }],
    [404, { kind: "gone" }],
    [410, { kind: "gone" }],
    [500, { kind: "retry", afterSeconds: undefined }],
    [403, { kind: "refused", status: 403 }],
    [413, { kind: "refused", status: 413 }],
  ])(
    "given the push service answers %i, when sent, then the outcome is %j",
    async (status, outcome) => {
      expect((await sendOnce(new Response(null, { status }))).outcome).toEqual(outcome);
    },
  );

  it("given 429 with Retry-After, when sent, then it is retried after that long", async () => {
    const busy = new Response(null, { status: 429, headers: { "retry-after": "90" } });

    expect((await sendOnce(busy)).outcome).toEqual({ kind: "retry", afterSeconds: 90 });
  });
});
