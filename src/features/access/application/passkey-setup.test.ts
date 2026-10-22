import { describe, expect, it } from "vitest";

import { formatCeremonyCookie } from "@/features/access/application/ceremony-cookie";
import { newSecretToken } from "@/features/access/application/secret-tokens";
import type { Account } from "@/features/access/domain/account";
import type { SetupLinkGrant } from "@/features/access/domain/setup-link";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSession, seedSetupLink } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import type { Tampering } from "@/testing/support/authenticator";
import { anAuthenticator, ceremonyIdIn, passkeyUseCases } from "@/testing/support/passkeys";
import { expectOk } from "@/testing/support/result";

const authenticator = anAuthenticator();

type Time = ReturnType<typeof testClock>;

// A setup link issued and redeemed in this browser: what the setup screen holds when it asks for the prompt
async function aRedeemedLink(
  time: Time,
  grantFor: (account: Account) => SetupLinkGrant,
  username = "lan",
) {
  const account = await seedAccount(time.clock, username);
  const { token } = await seedSetupLink(time.clock, grantFor(account));
  const grant = expectOk(await testApp(time.clock).redeemSetupLink(token, origin()));

  return { account, ceremonyCookie: grant.cookie, ceremonyId: grant.ceremony.id };
}

function aFirstSetup(time: Time) {
  return aRedeemedLink(time, (account) => ({ purpose: "first_setup", accountId: account.id }));
}

async function aPromptAnswered(time: Time, tampering: Tampering = {}) {
  const setup = await aFirstSetup(time);
  const passkeys = passkeyUseCases(time.clock);
  const options = expectOk(await passkeys.startPasskeySetup(setup.ceremonyCookie));
  const created = await authenticator.create(options, tampering);

  return { ...setup, passkeys, options, ...created };
}

describe("startPasskeySetup", () => {
  it("given a redeemed first-setup link, when the prompt is asked for, then it names the account and the setup holds its challenge", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, ceremonyCookie, ceremonyId } = await aFirstSetup(time);

    const options = expectOk(await passkeyUseCases(time.clock).startPasskeySetup(ceremonyCookie));

    expect(options.user).toEqual({
      id: account.userHandle,
      name: account.username,
      displayName: account.displayName,
    });
    expect(await rows("select id, challenge from ceremony")).toEqual([
      { id: ceremonyId, challenge: options.challenge },
    ]);
  });

  it("given a prompt asked for twice, when the second comes, then it carries a new challenge that replaces the first", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await aFirstSetup(time);
    const passkeys = passkeyUseCases(time.clock);

    const first = expectOk(await passkeys.startPasskeySetup(ceremonyCookie));
    const second = expectOk(await passkeys.startPasskeySetup(ceremonyCookie));

    expect(second.challenge).not.toBe(first.challenge);
    expect(await rows("select challenge from ceremony")).toEqual([{ challenge: second.challenge }]);
  });

  it("given an invite, which has no account yet, when the prompt is asked for, then the link is unusable here", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await aRedeemedLink(time, (account) => ({
      purpose: "invite",
      createdBy: account.id,
    }));

    expect(await passkeyUseCases(time.clock).startPasskeySetup(ceremonyCookie)).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given a setup redeemed 10 minutes ago, when the prompt is asked for, then the link is unusable", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await aFirstSetup(time);
    time.setTo("2026-10-22T01:10:00Z");

    expect(await passkeyUseCases(time.clock).startPasskeySetup(ceremonyCookie)).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it.each<[string, (cookie: string) => string | undefined]>([
    ["no cookie", () => undefined],
    ["a cookie that is not one", () => "setup"],
    [
      "the right ceremony with another browser's binding",
      (cookie) =>
        formatCeremonyCookie({
          ceremonyId: ceremonyIdIn(cookie),
          binding: newSecretToken(webCryptoSecrets),
        }),
    ],
  ])("given %s, when the prompt is asked for, then the link is unusable", async (_, cookieFrom) => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await aFirstSetup(time);

    expect(await passkeyUseCases(time.clock).startPasskeySetup(cookieFrom(ceremonyCookie))).toEqual(
      { ok: false, error: "setup_link_unusable" },
    );
  });

  it("given the cookie of a step-up prompt for the same account, when a setup prompt is asked for, then it is unusable", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account } = await aFirstSetup(time);
    const { session } = await seedSession(time.clock, account);
    const passkeys = passkeyUseCases(time.clock);
    const signIn = expectOk(
      await passkeys.startPasskeySignIn({ origin: origin(), stepUp: session }),
    );

    expect(await passkeys.startPasskeySetup(signIn.ceremonyCookie)).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });
});

describe("finishPasskeySetup", () => {
  it("given the prompt's answer, when it comes back, then the passkey is stored, the person is signed in with it and the setup is gone", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, passkeys, ceremonyCookie, response, passkey } = await aPromptAnswered(time);

    const finished = expectOk(
      await passkeys.finishPasskeySetup({
        ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    );

    expect(finished.passkey).toMatchObject({
      accountId: account.id,
      credentialId: passkey.credentialId,
      name: "Chrome trên Android",
    });
    expect(finished.session).toMatchObject({
      accountId: account.id,
      method: "passkey",
      passkeyId: finished.passkey.id,
    });
    expect(await rows("select credential_id from passkey")).toEqual([
      { credential_id: passkey.credentialId },
    ]);
    expect(await rows("select id from ceremony")).toEqual([]);
    expect(
      await rows(
        "select kind, passkey_id from access_event where kind in ('passkey_added', 'session_opened') order by kind",
      ),
    ).toEqual([
      { kind: "passkey_added", passkey_id: finished.passkey.id },
      { kind: "session_opened", passkey_id: finished.passkey.id },
    ]);
  });

  it("given the same answer sent twice at once, when both arrive, then exactly one passkey and one session come of it", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkeys, ceremonyCookie, response } = await aPromptAnswered(time);
    const request = { ceremonyCookie, response, origin: origin(), replacing: undefined };

    const outcomes = await Promise.allSettled([
      passkeys.finishPasskeySetup(request),
      passkeys.finishPasskeySetup(request),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value.ok),
    ).toHaveLength(1);
    expect(await rows("select id from passkey")).toHaveLength(1);
    expect(await rows("select id from session")).toHaveLength(1);
  });

  it("given a finished setup, when its answer is sent again, then the link is unusable", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkeys, ceremonyCookie, response } = await aPromptAnswered(time);
    const request = { ceremonyCookie, response, origin: origin(), replacing: undefined };
    await passkeys.finishPasskeySetup(request);

    expect(await passkeys.finishPasskeySetup(request)).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given an answer to an older prompt, when a newer one was asked for since, then it is refused and the newer prompt is spent too", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkeys, ceremonyCookie, response } = await aPromptAnswered(time);
    await passkeys.startPasskeySetup(ceremonyCookie);

    expect(
      await passkeys.finishPasskeySetup({
        ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    ).toEqual({ ok: false, error: "passkey_not_accepted" });
    expect(await rows("select challenge from ceremony")).toEqual([{ challenge: null }]);
    expect(await rows("select detail from access_event where kind = 'sign_in_failed'")).toEqual([
      { detail: JSON.stringify({ method: "passkey", step: "setup", reason: "challenge" }) },
    ]);
  });

  it("given a refused answer, when the prompt is asked for again, then the setup can still finish", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkeys, ceremonyCookie, response } = await aPromptAnswered(time, {
      flags: { userVerified: false },
    });
    await passkeys.finishPasskeySetup({
      ceremonyCookie,
      response,
      origin: origin(),
      replacing: undefined,
    });

    const retry = expectOk(await passkeys.startPasskeySetup(ceremonyCookie));
    const answered = await authenticator.create(retry);

    expect(
      await passkeys.finishPasskeySetup({
        ceremonyCookie,
        response: answered.response,
        origin: origin(),
        replacing: undefined,
      }),
    ).toMatchObject({ ok: true });
  });

  it("given a prompt asked for just before the setup's ten minutes ran out, when its answer comes after, then the link is unusable", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const setup = await aFirstSetup(time);
    time.setTo("2026-10-22T01:09:59Z");
    const passkeys = passkeyUseCases(time.clock);
    const options = expectOk(await passkeys.startPasskeySetup(setup.ceremonyCookie));
    const { response } = await authenticator.create(options);
    time.setTo("2026-10-22T01:10:00Z");

    expect(
      await passkeys.finishPasskeySetup({
        ceremonyCookie: setup.ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    ).toEqual({ ok: false, error: "setup_link_unusable" });
    expect(await rows("select id from passkey")).toEqual([]);
  });

  it("given no prompt was asked for, when an answer arrives, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await aFirstSetup(time);
    const { response } = await authenticator.create({
      challenge: "x".repeat(43),
      user: { id: "y".repeat(43) },
    });

    expect(
      await passkeyUseCases(time.clock).finishPasskeySetup({
        ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    ).toEqual({ ok: false, error: "passkey_not_accepted" });
  });

  it("given a credential already registered, when it answers another setup, then it is refused and stored once", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { passkeys, ceremonyCookie, response, passkey } = await aPromptAnswered(time);
    await passkeys.finishPasskeySetup({
      ceremonyCookie,
      response,
      origin: origin(),
      replacing: undefined,
    });
    const again = await aRedeemedLink(
      time,
      (account) => ({ purpose: "first_setup", accountId: account.id }),
      "minh",
    );
    const options = expectOk(await passkeys.startPasskeySetup(again.ceremonyCookie));
    const { response: reused } = await authenticator.create(options, { reuse: passkey });

    expect(
      await passkeys.finishPasskeySetup({
        ceremonyCookie: again.ceremonyCookie,
        response: reused,
        origin: origin(),
        replacing: undefined,
      }),
    ).toEqual({ ok: false, error: "passkey_not_accepted" });
    expect(await rows("select id from passkey")).toHaveLength(1);
    expect(
      await rows("select account_id, detail from access_event where kind = 'sign_in_failed'"),
    ).toEqual([
      {
        account_id: again.account.id,
        detail: JSON.stringify({ method: "passkey", step: "setup", reason: "already_registered" }),
      },
    ]);
  });

  it("given a recovery link, when its setup finishes, then every other session of the account ends", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const recovery = await aRedeemedLink(time, (account) => ({
      purpose: "recovery",
      accountId: account.id,
    }));
    await seedSession(time.clock, recovery.account);
    const passkeys = passkeyUseCases(time.clock);
    const options = expectOk(await passkeys.startPasskeySetup(recovery.ceremonyCookie));
    const { response } = await authenticator.create(options);

    const finished = expectOk(
      await passkeys.finishPasskeySetup({
        ceremonyCookie: recovery.ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    );

    expect(await rows("select id from session")).toEqual([{ id: finished.session.id }]);
    expect(
      await rows("select kind from access_event where kind = 'sessions_revoked'"),
    ).toHaveLength(1);
  });
});
