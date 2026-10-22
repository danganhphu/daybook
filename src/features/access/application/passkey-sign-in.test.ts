import { describe, expect, it } from "vitest";
import { z } from "zod";

import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSetupLink } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import type { SoftwarePasskey, Tampering } from "@/testing/support/authenticator";
import { anAuthenticator, ceremonyIdIn, passkeyUseCases } from "@/testing/support/passkeys";
import { expectOk } from "@/testing/support/result";

import { formatCeremonyCookie } from "./ceremony-cookie";
import { newSecretToken } from "./secret-tokens";

const authenticator = anAuthenticator();

const notAccepted = { ok: false, error: "passkey_not_accepted" };

const failure = z.object({ reason: z.string() });

type Time = ReturnType<typeof testClock>;

// Someone who went through setup: an account, the passkey on their phone, and the session setup opened
async function aPersonWithAPasskey(time: Time, username = "lan") {
  const account = await seedAccount(time.clock, username);
  const { token } = await seedSetupLink(time.clock, {
    purpose: "first_setup",
    accountId: account.id,
  });
  const grant = expectOk(await testApp(time.clock).redeemSetupLink(token, origin()));
  const passkeys = passkeyUseCases(time.clock);
  const options = expectOk(await passkeys.startPasskeySetup(grant.cookie));
  const { response, passkey } = await authenticator.create(options);
  const finished = expectOk(
    await passkeys.finishPasskeySetup({
      ceremonyCookie: grant.cookie,
      response,
      origin: origin(),
      replacing: undefined,
    }),
  );

  return { account, passkey, stored: finished.passkey, session: finished.session };
}

async function aSignIn(
  time: Time,
  passkey: SoftwarePasskey,
  options: {
    readonly tampering?: Tampering;
    readonly stepUp?: Session;
    readonly current?: Session;
  } = {},
) {
  const passkeys = passkeyUseCases(time.clock);
  const prompt = expectOk(
    await passkeys.startPasskeySignIn({
      origin: origin(),
      ...(options.stepUp === undefined ? {} : { stepUp: options.stepUp }),
    }),
  );
  const response = await authenticator.get(prompt.options, passkey, options.tampering);
  const request = {
    ceremonyCookie: prompt.ceremonyCookie,
    response,
    origin: origin(),
    current: options.current,
  };

  return { passkeys, prompt, request, finish: () => passkeys.finishPasskeySignIn(request) };
}

async function failureReasons() {
  const failed = await rows<{ detail: string }>(
    "select detail from access_event where kind = 'sign_in_failed'",
  );

  return failed.map((row) => failure.parse(JSON.parse(row.detail)).reason);
}

describe("startPasskeySignIn", () => {
  it("given a sign-in screen, when it asks for a prompt, then any passkey for this site may answer, user-verified", async () => {
    const time = testClock("2026-10-22T01:00:00Z");

    const prompt = expectOk(
      await passkeyUseCases(time.clock).startPasskeySignIn({ origin: origin() }),
    );

    expect(prompt.options).toMatchObject({ allowCredentials: [], userVerification: "required" });
    expect(await rows("select kind, challenge, account_id from ceremony")).toEqual([
      { kind: "passkey_sign_in", challenge: prompt.options.challenge, account_id: null },
    ]);
  });

  it("given a step-up, when it asks for a prompt, then only that account's passkeys are offered", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, stored, session } = await aPersonWithAPasskey(time);

    const prompt = expectOk(
      await passkeyUseCases(time.clock).startPasskeySignIn({ origin: origin(), stepUp: session }),
    );

    expect(prompt.options.allowCredentials).toEqual([
      { id: stored.credentialId, type: "public-key", transports: ["internal", "hybrid"] },
    ]);
    expect(await rows("select account_id from ceremony")).toEqual([{ account_id: account.id }]);
  });

  it("given prompts abandoned more than five minutes ago, when a new one is asked for, then they are swept", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const passkeys = passkeyUseCases(time.clock);
    await passkeys.startPasskeySignIn({ origin: origin() });
    time.setTo("2026-10-22T01:05:00Z");

    const prompt = expectOk(await passkeys.startPasskeySignIn({ origin: origin() }));

    expect(await rows("select id from ceremony")).toEqual([
      { id: ceremonyIdIn(prompt.ceremonyCookie) },
    ]);
  });

  it("given thirty prompts from one address, when a thirty-first is asked for, then it is refused as rate limited", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const passkeys = passkeyUseCases(time.clock);
    const thirty = await Promise.all(
      Array.from({ length: 30 }, () =>
        passkeys.startPasskeySignIn({ origin: origin("198.51.100.4") }),
      ),
    );

    expect(thirty.every((prompt) => prompt.ok)).toBe(true);
    expect(await passkeys.startPasskeySignIn({ origin: origin("198.51.100.4") })).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(await passkeys.startPasskeySignIn({ origin: origin("198.51.100.5") })).toMatchObject({
      ok: true,
    });
  });
});

describe("finishPasskeySignIn", () => {
  it("given a passkey's answer, when it comes back, then a passkey session opens and the passkey's use is recorded", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, passkey, stored } = await aPersonWithAPasskey(time);
    time.setTo("2026-10-22T02:00:00Z");
    const { finish } = await aSignIn(time, passkey, { tampering: { counter: 3 } });

    const opened = expectOk(await finish());

    expect(opened.session).toMatchObject({
      accountId: account.id,
      method: "passkey",
      passkeyId: stored.id,
    });
    expect(await rows("select sign_count, last_used_at from passkey")).toEqual([
      { sign_count: 3, last_used_at: Date.parse("2026-10-22T02:00:00Z") },
    ]);
    expect(await rows("select id from ceremony")).toEqual([]);
  });

  it("given a browser already signed in, when it signs in again, then its old session is replaced", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey, session } = await aPersonWithAPasskey(time);
    const { finish } = await aSignIn(time, passkey, { current: session });

    const opened = expectOk(await finish());

    expect(await rows("select id from session")).toEqual([{ id: opened.session.id }]);
  });

  it("given an answer already used, when it is sent again, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const { finish } = await aSignIn(time, passkey);
    await finish();

    expect(await finish()).toEqual(notAccepted);
  });

  it("given the same answer sent twice at once, when both arrive, then one session opens", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const { finish } = await aSignIn(time, passkey);
    const before = await rows("select id from session");

    const outcomes = await Promise.all([finish(), finish()]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(await rows("select id from session")).toHaveLength(before.length + 1);
  });

  it("given a prompt five minutes old, when its answer arrives, then it is refused as expired", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const { finish } = await aSignIn(time, passkey);
    time.setTo("2026-10-22T01:05:00Z");

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["expired"]);
  });

  it("given the prompt's cookie with another browser's binding, when the answer arrives, then it is refused and nothing is logged", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const { passkeys, request } = await aSignIn(time, passkey);
    const ceremonyId = ceremonyIdIn(request.ceremonyCookie);

    expect(
      await passkeys.finishPasskeySignIn({
        ...request,
        ceremonyCookie: formatCeremonyCookie({
          ceremonyId,
          binding: newSecretToken(webCryptoSecrets),
        }),
      }),
    ).toEqual(notAccepted);
    expect(await failureReasons()).toEqual([]);
    // The real browser can still finish
    expect(await passkeys.finishPasskeySignIn(request)).toMatchObject({ ok: true });
  });

  it("given a passkey this site does not know, when it answers, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const { response: elsewhere } = await authenticator.create({
      challenge: "x".repeat(43),
      user: { id: passkey.userHandle },
    });
    const stranger = { ...passkey, credentialId: elsewhere.id };
    const { finish } = await aSignIn(time, stranger);

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["unknown_credential"]);
  });

  it("given an answer whose user handle names someone else, when it arrives, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const other = await aPersonWithAPasskey(time, "minh");
    const { finish } = await aSignIn(time, passkey, {
      tampering: { userHandle: other.passkey.userHandle },
    });

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["user_handle"]);
  });

  it.each<[string, Tampering, string]>([
    ["another origin", { origin: "https://evil.example" }, "origin"],
    ["another RP ID", { rpId: "evil.example" }, "rp_id"],
    ["no user verification", { flags: { userVerified: false } }, "user_verification"],
  ])(
    "given an answer with %s, when it arrives, then it is refused for that reason",
    async (_, tampering, reason) => {
      const time = testClock("2026-10-22T01:00:00Z");
      const { passkey } = await aPersonWithAPasskey(time);
      const { finish } = await aSignIn(time, passkey, { tampering });

      expect(await finish()).toEqual(notAccepted);
      expect(await failureReasons()).toEqual([reason]);
    },
  );

  it("given an answer signed by another key, when it arrives, then it is refused as a bad signature", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    const impostor = await authenticator.create({
      challenge: "x".repeat(43),
      user: { id: passkey.userHandle },
    });
    const { finish } = await aSignIn(time, passkey, {
      tampering: { signWith: impostor.passkey.keys.privateKey },
    });

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["signature"]);
  });

  it("given a counter that did not move forward, when the answer arrives, then it is accepted and the stall is noted", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey } = await aPersonWithAPasskey(time);
    expectOk(await (await aSignIn(time, passkey, { tampering: { counter: 5 } })).finish());

    const opened = expectOk(
      await (await aSignIn(time, passkey, { tampering: { counter: 5 } })).finish(),
    );

    const [event] = await rows<{ detail: string }>(
      "select detail from access_event where kind = 'session_opened' and session_id = ?",
      opened.session.id,
    );
    expect(JSON.parse(event?.detail ?? "{}")).toEqual({ counter: "stalled", method: "passkey" });
    expect(await rows("select sign_count from passkey")).toEqual([{ sign_count: 5 }]);
  });

  it("given a step-up, when the account's own passkey answers, then a fresh session replaces the old one", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkey, session } = await aPersonWithAPasskey(time);
    time.setTo("2026-10-22T03:00:00Z");
    expect(Sessions.isFresh(session, time.clock())).toBe(false);
    const { finish } = await aSignIn(time, passkey, { stepUp: session, current: session });

    const opened = expectOk(await finish());

    expect(Sessions.isFresh(opened.session, time.clock())).toBe(true);
    expect(await rows("select id from session")).toEqual([{ id: opened.session.id }]);
  });

  it("given a step-up, when another account's passkey answers, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await aPersonWithAPasskey(time);
    const other = await aPersonWithAPasskey(time, "minh");
    const { finish } = await aSignIn(time, other.passkey, { stepUp: session, current: session });

    expect(await finish()).toEqual(notAccepted);
    expect(await failureReasons()).toEqual(["other_account"]);
  });

  it("given junk with no prompt behind it, when it arrives, then it is refused and the log does not grow", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const before = await rows("select id from access_event");

    expect(
      await passkeyUseCases(time.clock).finishPasskeySignIn({
        ceremonyCookie: "junk",
        response: { anything: true },
        origin: origin(),
        current: undefined,
      }),
    ).toEqual(notAccepted);
    expect(await rows("select id from access_event")).toEqual(before);
  });
});
