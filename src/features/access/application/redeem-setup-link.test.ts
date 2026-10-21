import { describe, expect, it } from "vitest";

import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSetupLink } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { hashSecretToken, newSecretToken } from "./secret-tokens";

const unusable = { ok: false, error: "setup_link_unusable" };

async function aFirstSetupLink(time: ReturnType<typeof testClock>) {
  const account = await seedAccount(time.clock);

  return {
    account,
    ...(await seedSetupLink(time.clock, { purpose: "first_setup", accountId: account.id })),
  };
}

describe("redeemSetupLink", () => {
  it("given a fresh link, when redeemed, then a setup ceremony bound to this browser starts and the link is spent", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { account, link, token } = await aFirstSetupLink(time);
    time.setTo("2026-10-21T01:01:00Z");

    const grant = expectOk(await app.redeemSetupLink(token, origin()));

    expect(grant.purpose).toBe("first_setup");
    expect(grant.ceremony.kind).toBe("setup");
    expect(grant.ceremony.accountId).toBe(account.id);
    expect(grant.ceremony.setupLinkId).toBe(link.id);
    expect(grant.ceremony.bindingHash).toBe(await hashSecretToken(webCryptoSecrets, grant.binding));
    expect(await rows("select id from ceremony")).toEqual([{ id: grant.ceremony.id }]);
    expect(await rows("select redeemed_at from setup_link")).toEqual([
      { redeemed_at: Date.parse("2026-10-21T01:01:00Z") },
    ]);
  });

  it("given a spent link, when redeemed again, then it is refused", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { token } = await aFirstSetupLink(time);
    await app.redeemSetupLink(token, origin());

    expect(await app.redeemSetupLink(token, origin())).toEqual(unusable);
  });

  it("given a link issued 10 minutes ago, when redeemed, then it is refused", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { token } = await aFirstSetupLink(time);
    time.setTo("2026-10-21T01:10:00Z");

    expect(await app.redeemSetupLink(token, origin())).toEqual(unusable);
  });

  it("given a well-formed token that matches no link, when redeemed, then it is refused the same way", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    await aFirstSetupLink(time);

    expect(
      await testApp(time.clock).redeemSetupLink(newSecretToken(webCryptoSecrets), origin()),
    ).toEqual(unusable);
  });

  it("given text that is no token at all, when redeemed, then it is refused the same way", async () => {
    const time = testClock("2026-10-21T01:00:00Z");

    expect(
      await testApp(time.clock).redeemSetupLink("'; drop table account; --", origin()),
    ).toEqual(unusable);
  });

  it("given a refused link, when redeemed, then the attempt is recorded with the address it came from", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { account, token } = await aFirstSetupLink(time);
    time.setTo("2026-10-21T02:00:00Z");

    await app.redeemSetupLink(token, origin("198.51.100.4"));

    expect(
      await rows("select account_id, ip from access_event where kind = 'setup_link_refused'"),
    ).toEqual([{ account_id: account.id, ip: "198.51.100.4" }]);
  });

  it("given ten attempts from one address, when an eleventh comes, then it is refused as rate limited even with a good link", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { token } = await aFirstSetupLink(time);
    const firstTen = await Promise.all(
      Array.from({ length: 10 }, () => app.redeemSetupLink("guess", origin("198.51.100.4"))),
    );

    expect(firstTen).toEqual(Array.from({ length: 10 }, () => unusable));

    expect(await app.redeemSetupLink(token, origin("198.51.100.4"))).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(await app.redeemSetupLink(token, origin("198.51.100.5"))).toMatchObject({ ok: true });
  });

  it("given an IPv6 client hopping addresses inside its /64, when it passes the limit, then hopping does not help", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { token } = await aFirstSetupLink(time);
    await Promise.all(
      Array.from({ length: 10 }, (_, host) =>
        app.redeemSetupLink("guess", origin(`2001:db8:1:2::${host + 1}`)),
      ),
    );

    expect(await app.redeemSetupLink(token, origin("2001:db8:1:2::ff"))).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("given the same link redeemed twice at once, when both finish, then exactly one setup ceremony exists", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const app = testApp(time.clock);
    const { token } = await aFirstSetupLink(time);

    const outcomes = await Promise.allSettled([
      app.redeemSetupLink(token, origin()),
      app.redeemSetupLink(token, origin()),
    ]);

    const granted = outcomes.filter(
      (outcome) => outcome.status === "fulfilled" && outcome.value.ok,
    );
    expect(granted).toHaveLength(1);
    expect(await rows("select id from ceremony")).toHaveLength(1);
  });
});

describe("issueSetupLink", () => {
  it("given a link, when issued, then the database holds the token's hash and never the token", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const { token } = await aFirstSetupLink(time);

    const stored = await rows<Record<string, unknown>>("select * from setup_link");
    const events = await rows<Record<string, unknown>>("select * from access_event");

    expect(stored).toEqual([
      expect.objectContaining({ token_hash: await hashSecretToken(webCryptoSecrets, token) }),
    ]);
    expect(JSON.stringify([stored, events])).not.toContain(token);
  });
});
