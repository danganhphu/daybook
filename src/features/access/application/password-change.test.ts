import { describe, expect, it } from "vitest";

import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock, testPeppers } from "@/testing/support/app";
import { aDerivedKey } from "@/testing/support/passwords";
import { expectOk } from "@/testing/support/result";

import { verifierFor } from "./password-keys";

const notSaved = { ok: false, error: "password_not_saved" };
const stepUp = { ok: false, error: "step_up_required" };

async function aFreshSession(time: ReturnType<typeof testClock>, username = "lan") {
  const account = await seedAccount(time.clock, username);
  const { session } = await seedSession(time.clock, account);

  return { account, session };
}

describe("password change", () => {
  it("given a fresh session, when a password is set, then only the pepper's HMAC of the key is kept", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session } = await aFreshSession(time);
    const app = testApp(time.clock);
    const prompt = expectOk(await app.beginPasswordChange(session));
    const key = aDerivedKey();

    expectOk(
      await app.finishPasswordChange(session, {
        ceremonyCookie: prompt.ceremonyCookie,
        key,
        origin: origin(),
      }),
    );

    const stored = await rows<Record<string, unknown>>("select * from password");
    expect(stored).toEqual([
      expect.objectContaining({
        account_id: account.id,
        salt: prompt.salt,
        verifier: await verifierFor(webCryptoSecrets, testPeppers.current, key),
        pepper_version: 1,
        consecutive_failures: 0,
        locked_at: null,
      }),
    ]);
    expect(JSON.stringify(await rows("select * from access_event"))).not.toContain(key);
    expect(await rows("select kind from access_event where kind like 'password%'")).toEqual([
      { kind: "password_set" },
    ]);
  });

  it("given two prompts, when they are asked for, then each has its own random salt", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aFreshSession(time);
    const app = testApp(time.clock);

    const first = expectOk(await app.beginPasswordChange(session));
    const second = expectOk(await app.beginPasswordChange(session));

    expect(first.salt).not.toBe(second.salt);
  });

  it("given a locked password, when it is changed, then it starts again unlocked", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aFreshSession(time);
    const app = testApp(time.clock);
    async function change() {
      const prompt = expectOk(await app.beginPasswordChange(session));
      expectOk(
        await app.finishPasswordChange(session, {
          ceremonyCookie: prompt.ceremonyCookie,
          key: aDerivedKey(),
          origin: origin(),
        }),
      );
    }
    await change();
    await rows("update password set consecutive_failures = 100, locked_at = 1");

    await change();

    expect(await rows("select consecutive_failures, locked_at from password")).toEqual([
      { consecutive_failures: 0, locked_at: null },
    ]);
    expect(await rows("select kind from access_event where kind like 'password%'")).toEqual([
      { kind: "password_set" },
      { kind: "password_changed" },
    ]);
  });

  it("given a sign-in more than five minutes old, when a change starts, then it asks for step-up", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aFreshSession(time);
    time.setTo("2026-10-22T01:05:00Z");

    expect(await testApp(time.clock).beginPasswordChange(session)).toEqual(stepUp);
  });

  it("given a change begun just in time, when the key arrives after the window, then step-up is asked again", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aFreshSession(time);
    const app = testApp(time.clock);
    time.setTo("2026-10-22T01:04:59Z");
    const prompt = expectOk(await app.beginPasswordChange(session));
    time.setTo("2026-10-22T01:05:00Z");

    expect(
      await app.finishPasswordChange(session, {
        ceremonyCookie: prompt.ceremonyCookie,
        key: aDerivedKey(),
        origin: origin(),
      }),
    ).toEqual(stepUp);
    expect(await rows("select * from password")).toEqual([]);
  });

  it("given another account's change, when its cookie is used, then nothing is saved", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await aFreshSession(time, "lan");
    const minh = await aFreshSession(time, "minh");
    const app = testApp(time.clock);
    const prompt = expectOk(await app.beginPasswordChange(lan.session));

    expect(
      await app.finishPasswordChange(minh.session, {
        ceremonyCookie: prompt.ceremonyCookie,
        key: aDerivedKey(),
        origin: origin(),
      }),
    ).toEqual(notSaved);
    expect(await rows("select * from password")).toEqual([]);
  });

  it.each([
    ["sent twice", "twice"],
    ["not a key", "malformed"],
  ])("given a key %s, when it arrives, then nothing more is saved", async (_, kind) => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aFreshSession(time);
    const app = testApp(time.clock);
    const prompt = expectOk(await app.beginPasswordChange(session));
    const request = { ceremonyCookie: prompt.ceremonyCookie, key: aDerivedKey(), origin: origin() };
    if (kind === "twice") {
      await app.finishPasswordChange(session, request);
    }

    expect(
      await app.finishPasswordChange(session, {
        ...request,
        key: kind === "twice" ? aDerivedKey() : "not a key",
      }),
    ).toEqual(notSaved);
    expect(await rows("select * from password")).toHaveLength(kind === "twice" ? 1 : 0);
  });
});
