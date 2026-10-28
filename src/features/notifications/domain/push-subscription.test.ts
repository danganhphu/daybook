import { describe, expect, it } from "vitest";

import { isKnownPushService, pushEndpointSchema } from "./push-subscription";

describe("isKnownPushService", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    // What headless Chromium handed out in the spike (artifacts/2026-10-28-notifications-spike)
    "https://jmt17.google.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
  ])("given %s, when checked, then it is a push service's", (endpoint) => {
    expect(isKnownPushService(pushEndpointSchema.parse(endpoint))).toBe(true);
  });

  it.each([
    "https://attacker.example/fcm/send/abc",
    "https://google.com.attacker.example/send",
    "https://notgoogle.com/send",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://user:pass@fcm.googleapis.com/fcm/send/abc",
  ])("given %s, when checked, then it is refused", (endpoint) => {
    expect(isKnownPushService(pushEndpointSchema.parse(endpoint))).toBe(false);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "not a url",
    `https://fcm.googleapis.com/${"a".repeat(2048)}`,
  ])("given %s, when parsed as an endpoint, then it is not one", (endpoint) => {
    expect(pushEndpointSchema.safeParse(endpoint).success).toBe(false);
  });
});
