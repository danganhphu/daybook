import { describe, expect, it } from "vitest";
import { z } from "zod";

import { passwordLockAfter } from "@/features/access/domain/access-policy";
import { currentArgon2Parameters } from "@/features/access/domain/password";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock, testPeppers } from "@/testing/support/app";
import { ceremonyIdIn } from "@/testing/support/passkeys";
import { aDerivedKey, seedPassword } from "@/testing/support/passwords";
import { expectOk } from "@/testing/support/result";

import { formatCeremonyCookie } from "./ceremony-cookie";
import { decoySaltFor } from "./password-keys";
import { newSecretToken } from "./secret-tokens";

const notAccepted = { ok: false, error: "password_not_accepted" };
const rateLimited = { ok: false, error: "rate_limited" };

const failure = z.object({ reason: z.string() });

type Time = ReturnType<typeof testClock>;

async function failureReasons() {
  const failed = await rows<{ detail: string }>(
    "select detail from access_event where kind = 'sign_in_failed'",
  );

  return failed.map((row) => failure.parse(JSON.parse(row.detail)).reason);
}

async function aPersonWithAPassword(time: Time) {
  const account = await seedAccount(time.clock);

  return { account, ...(await seedPassword(time, account)) };
}

async function signIn(time: Time, username: unknown, key: unknown, from = origin()) {
  const app = testApp(time.clock);
  const prompt = expectOk(await app.beginPasswordSignIn(username, from));
  const request = { ceremonyCookie: prompt.ceremonyCookie, key, origin: from, current: undefined };

  return { app, prompt, request, finish: () => app.finishPasswordSignIn(request) };
}

describe("beginPasswordSignIn", () => {
  it("given a username with a password, when asked, then the stored salt and cost come back", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { salt } = await aPersonWithAPassword(time);

    const prompt = expectOk(await testApp(time.clock).beginPasswordSignIn("lan", origin()));

    expect(prompt.salt).toBe(salt);
    expect(prompt.parameters).toEqual(currentArgon2Parameters);
  });

  it.each([
    ["a username nobody has", "nobody"],
    ["a username typed in capitals", "NOBODY"],
    ["text that is no username at all", "x y"],
  ])(
    "given %s, when asked twice, then the same decoy salt comes back, shaped like a real one",
    async (_, username) => {
      const time = testClock("2026-10-22T01:00:00Z");
      const app = testApp(time.clock);

      const first = expectOk(await app.beginPasswordSignIn(username, origin()));
      const second = expectOk(await app.beginPasswordSignIn(username, origin()));

      expect(first.salt).toBe(second.salt);
      expect(first.salt).toBe(
        await decoySaltFor(webCryptoSecrets, testPeppers.current, username.trim().toLowerCase()),
      );
      expect(first.parameters).toEqual(currentArgon2Parameters);
    },
  );

  it("given an account with no password, when asked, then it gets a decoy like a stranger", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    await seedAccount(time.clock);

    const prompt = expectOk(await testApp(time.clock).beginPasswordSignIn("lan", origin()));

    expect(prompt.salt).toBe(await decoySaltFor(webCryptoSecrets, testPeppers.current, "lan"));
  });

  it.each([["lan"], ["nobody"]])(
    "given ten tries for %s, when an eleventh comes from another address, then it is refused all the same",
    async (username) => {
      const time = testClock("2026-10-22T01:00:00Z");
      await aPersonWithAPassword(time);
      const app = testApp(time.clock);
      const ten = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          app.beginPasswordSignIn(username, origin(`198.51.100.${index + 1}`)),
        ),
      );

      expect(ten.every((prompt) => prompt.ok)).toBe(true);
      expect(await app.beginPasswordSignIn(username, origin("203.0.113.99"))).toEqual(rateLimited);
    },
  );

  it("given twenty tries from one address, when a twenty-first comes for any username, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const app = testApp(time.clock);
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        app.beginPasswordSignIn(`user${index}`, origin("198.51.100.4")),
      ),
    );

    expect(await app.beginPasswordSignIn("someone", origin("198.51.100.4"))).toEqual(rateLimited);
    expect(await app.beginPasswordSignIn("someone", origin("198.51.100.5"))).toMatchObject({
      ok: true,
    });
  });
});

describe("finishPasswordSignIn", () => {
  it("given the right key, when it arrives, then a password session opens and the prompt is gone", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, key } = await aPersonWithAPassword(time);
    const { finish } = await signIn(time, "lan", key);

    const opened = expectOk(await finish());

    expect(opened.session).toMatchObject({
      accountId: account.id,
      method: "password",
      passkeyId: undefined,
    });
    expect(await rows("select kind from ceremony where kind = 'password_sign_in'")).toEqual([]);
  });

  it("given a browser already signed in, when it signs in with the password, then its old session is replaced", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, key } = await aPersonWithAPassword(time);
    const { session: old } = await seedSession(time.clock, account);
    const { app, request } = await signIn(time, "lan", key);
    await rows("delete from session where id != ?", old.id);

    const opened = expectOk(await app.finishPasswordSignIn({ ...request, current: old }));

    expect(await rows("select id from session")).toEqual([{ id: opened.session.id }]);
  });

  it("given a wrong key, when it arrives, then it is refused and counted", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    await aPersonWithAPassword(time);
    const { finish } = await signIn(time, "lan", aDerivedKey());

    expect(await finish()).toEqual(notAccepted);
    expect(await rows("select consecutive_failures from password")).toEqual([
      { consecutive_failures: 1 },
    ]);
    expect(await failureReasons()).toEqual(["wrong_password"]);
  });

  it("given earlier wrong keys, when the right one arrives, then the count starts again", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { key } = await aPersonWithAPassword(time);
    await (await signIn(time, "lan", aDerivedKey())).finish();

    expectOk(await (await signIn(time, "lan", key)).finish());

    expect(await rows("select consecutive_failures from password")).toEqual([
      { consecutive_failures: 0 },
    ]);
  });

  it("given a username nobody has, when a key arrives, then it is refused like a wrong password", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { finish } = await signIn(time, "nobody", aDerivedKey());

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["no_password"]);
  });

  it("given a hundred wrong keys in a row, when the right one comes, then the password is locked and refuses it", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { key } = await aPersonWithAPassword(time);
    await rows("update password set consecutive_failures = ?", passwordLockAfter - 1);
    await (await signIn(time, "lan", aDerivedKey())).finish();

    expect(await rows("select kind from access_event where kind = 'password_locked'")).toHaveLength(
      1,
    );
    expect(await (await signIn(time, "lan", key)).finish()).toEqual(notAccepted);
    expect((await failureReasons()).at(-1)).toBe("locked");
  });

  it("given a sign-in already finished, when its key is sent again, then it is refused and not logged", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { key } = await aPersonWithAPassword(time);
    const { finish } = await signIn(time, "lan", key);
    await finish();
    const before = await rows("select id from access_event");

    expect(await finish()).toEqual(notAccepted);
    expect(await rows("select id from access_event")).toEqual(before);
  });

  it("given the same key sent twice at once, when both arrive, then one session opens", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { key } = await aPersonWithAPassword(time);
    const { finish } = await signIn(time, "lan", key);
    const before = await rows("select id from session");

    const outcomes = await Promise.all([finish(), finish()]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(await rows("select id from session")).toHaveLength(before.length + 1);
  });

  it("given the cookie with another browser's binding, when the key arrives, then it is refused and not logged", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { key } = await aPersonWithAPassword(time);
    const { app, request } = await signIn(time, "lan", key);
    const forged = formatCeremonyCookie({
      ceremonyId: ceremonyIdIn(request.ceremonyCookie),
      binding: newSecretToken(webCryptoSecrets),
    });

    expect(await app.finishPasswordSignIn({ ...request, ceremonyCookie: forged })).toEqual(
      notAccepted,
    );
    expect(await failureReasons()).toEqual([]);
  });

  it.each([
    ["five minutes after the prompt", "2026-10-22T01:05:00Z", "expired", undefined],
    ["a key that is not one", "2026-10-22T01:00:00Z", "malformed", "not a key"],
  ])(
    "given %s, when it arrives, then it is refused for that reason",
    async (_, at, reason, sent) => {
      const time = testClock("2026-10-22T01:00:00Z");
      const { key } = await aPersonWithAPassword(time);
      const { finish } = await signIn(time, "lan", sent ?? key);
      time.setTo(at);

      expect(await finish()).toEqual(notAccepted);
      expect(await failureReasons()).toEqual([reason]);
    },
  );
});
