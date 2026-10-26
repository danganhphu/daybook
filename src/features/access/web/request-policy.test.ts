import { describe, expect, it } from "vitest";

import {
  contentSecurityPolicy,
  isCrossSiteWrite,
  needsSignIn,
  newNonce,
  securityHeaders,
} from "./request-policy";

const appOrigin = new URL("https://daybook.example.workers.dev");

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("isCrossSiteWrite", () => {
  it.each(["GET", "HEAD", "OPTIONS", "get"])(
    "given a %s from anywhere, when checked, then it is let through: it changes nothing",
    (method) => {
      expect(isCrossSiteWrite(method, headers({ "sec-fetch-site": "cross-site" }), appOrigin)).toBe(
        false,
      );
    },
  );

  it.each([
    ["same-origin", false],
    ["same-site", true],
    ["cross-site", true],
    ["none", true],
  ])("given a POST with Sec-Fetch-Site %s, when checked, then refused is %s", (site, refused) => {
    expect(isCrossSiteWrite("POST", headers({ "sec-fetch-site": site }), appOrigin)).toBe(refused);
  });

  it("given Sec-Fetch-Site says same-origin, when Origin says otherwise, then the browser's own header wins", () => {
    const sent = headers({ "sec-fetch-site": "same-origin", origin: "https://evil.example" });

    expect(isCrossSiteWrite("POST", sent, appOrigin)).toBe(false);
  });

  it.each([
    ["this app's origin", { origin: "https://daybook.example.workers.dev" }, false],
    ["another origin", { origin: "https://evil.example" }, true],
    ["the right host over http", { origin: "http://daybook.example.workers.dev" }, true],
    ["no Origin at all", {}, true],
  ])(
    "given a POST without Fetch Metadata and %s, when checked, then refused is %s",
    (_, sent, refused) => {
      expect(isCrossSiteWrite("POST", headers(sent), appOrigin)).toBe(refused);
    },
  );
});

describe("needsSignIn", () => {
  it.each([
    ["GET", "/", false, true],
    ["GET", "/", true, false],
    ["GET", "/sign-in", false, false],
    ["GET", "/setup", false, false],
    ["GET", "/somewhere/else", false, true],
    // The installed app's manifest and icons, which the sign-in page needs before anyone has a session
    ["GET", "/manifest.webmanifest", false, false],
    ["GET", "/icon.svg", false, false],
    // A build file the Worker did not find is a 404, not a sign-in page
    ["GET", "/_next/static/chunks/gone.js", false, false],
    // A server action without a cookie is refused by the action itself, not redirected here
    ["POST", "/", false, false],
  ])(
    "given %s %s with a session cookie: %s, when checked, then redirected is %s",
    (method, path, cookie, redirected) => {
      expect(needsSignIn(method, path, cookie)).toBe(redirected);
    },
  );
});

describe("contentSecurityPolicy", () => {
  it("given a nonce, when the policy is made, then scripts and styles need it and nothing may frame the app", () => {
    const policy = contentSecurityPolicy("abc123");

    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-abc123'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("given two requests, when nonces are made, then they differ and carry 128 bits", () => {
    const first = newNonce();

    expect(first).not.toBe(newNonce());
    expect(atob(first)).toHaveLength(16);
  });
});

describe("securityHeaders", () => {
  it("given an https request, when headers are made, then HSTS is among them", () => {
    expect(securityHeaders("policy", true)).toMatchObject({
      "strict-transport-security": "max-age=63072000; includeSubDomains",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    });
  });

  it("given a plain http request, when headers are made, then HSTS is left out", () => {
    expect(securityHeaders("policy", false)).not.toHaveProperty("strict-transport-security");
  });
});
