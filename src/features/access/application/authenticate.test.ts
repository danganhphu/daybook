import { describe, expect, it } from "vitest";

import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { hashSecretToken, newSecretToken } from "./secret-tokens";
import { formatSessionCookie, parseSessionCookie } from "./session-cookie";

const unauthenticated = { ok: false, error: "unauthenticated" };

// The cookie a seeded session hands out, taken apart
function partsOf(cookie: string) {
  const parts = parseSessionCookie(cookie);
  if (parts === undefined) {
    throw new Error("The seeded cookie did not parse");
  }

  return parts;
}

describe("authenticate", () => {
  it("given the cookie a sign-in set, when presented, then it answers with that session", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock);
    const { session, cookie } = await seedSession(time.clock, account);

    const authenticated = expectOk(await testApp(time.clock).authenticate(cookie));

    expect(authenticated.id).toBe(session.id);
    expect(authenticated.accountId).toBe(account.id);
  });

  it.each([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a malformed cookie", "abc.def"],
  ])("given %s, when presented, then it is unauthenticated", async (_, cookie) => {
    const time = testClock("2026-10-21T01:00:00Z");

    expect(await testApp(time.clock).authenticate(cookie)).toEqual(unauthenticated);
  });

  it("given a real session id with a forged secret, when presented, then it is unauthenticated", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { cookie } = await seedSession(time.clock, await seedAccount(time.clock));
    const forged = formatSessionCookie({
      sessionId: partsOf(cookie).sessionId,
      secret: newSecretToken(webCryptoSecrets),
    });

    expect(await testApp(time.clock).authenticate(forged)).toEqual(unauthenticated);
  });

  it("given a session, when stored, then the database holds the secret's hash and never the secret", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { cookie } = await seedSession(time.clock, await seedAccount(time.clock));
    const { secret } = partsOf(cookie);

    const stored = await rows<Record<string, unknown>>("select * from session");

    expect(stored).toEqual([
      expect.objectContaining({ verifier: await hashSecretToken(webCryptoSecrets, secret) }),
    ]);
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it("given a session 30 days old, when presented, then it is unauthenticated and the row is gone", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { cookie } = await seedSession(time.clock, await seedAccount(time.clock));
    time.setTo("2026-11-20T01:00:00Z");

    expect(await testApp(time.clock).authenticate(cookie)).toEqual(unauthenticated);
    expect(await rows("select id from session")).toEqual([]);
  });

  it("given a session used 59 minutes after sign-in, when presented, then last-seen is not rewritten", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { cookie } = await seedSession(time.clock, await seedAccount(time.clock));
    time.setTo("2026-10-21T01:59:00Z");

    await testApp(time.clock).authenticate(cookie);

    expect(await rows("select last_seen_at from session")).toEqual([
      { last_seen_at: Date.parse("2026-10-21T01:00:00Z") },
    ]);
  });

  it("given a session used an hour after sign-in, when presented, then last-seen moves to now", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { cookie } = await seedSession(time.clock, await seedAccount(time.clock));
    time.setTo("2026-10-21T02:00:00Z");

    const session = expectOk(await testApp(time.clock).authenticate(cookie));

    expect(session.lastSeenAt.toString()).toBe("2026-10-21T02:00:00Z");
    expect(await rows("select last_seen_at from session")).toEqual([
      { last_seen_at: Date.parse("2026-10-21T02:00:00Z") },
    ]);
  });

  it("given a browser that signs in again, when its old cookie is presented, then the old session is gone", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock);
    const first = await seedSession(time.clock, account);
    const second = await seedSession(time.clock, account, { replacing: first.session.id });
    const app = testApp(time.clock);

    expect(await app.authenticate(first.cookie)).toEqual(unauthenticated);
    expect(await app.authenticate(second.cookie)).toMatchObject({ ok: true });
  });
});

describe("signOut", () => {
  it("given a signed-in device, when it signs out, then its cookie stops working and the others keep theirs", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, account);
    const laptop = await seedSession(time.clock, account);
    const app = testApp(time.clock);

    await app.signOut(phone.session, origin());

    expect(await app.authenticate(phone.cookie)).toEqual(unauthenticated);
    expect(await app.authenticate(laptop.cookie)).toMatchObject({ ok: true });
    expect(
      await rows("select kind, session_id from access_event where kind = 'session_ended'"),
    ).toEqual([{ kind: "session_ended", session_id: phone.session.id }]);
  });
});
