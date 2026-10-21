import { env } from "cloudflare:workers";
import type { Query } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { createOperatorConsole } from "./operator-console";

// What scripts/access.ts does with cf, done here with the test's D1: run the recorded statements as one batch
async function apply(statements: ReadonlyArray<Query>) {
  await env.DB.batch(
    statements.map((statement) => env.DB.prepare(statement.sql).bind(...statement.params)),
  );
}

function details(username: string, name: string) {
  return { username: usernameSchema.parse(username), displayName: displayNameSchema.parse(name) };
}

describe("createOperatorConsole", () => {
  it("given a new account, when its statements run, then the account exists and its first-setup link works in the app", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const created = await createOperatorConsole(time.clock).createAccount(details("minh", "Minh"));

    await apply(created.statements);

    expect(await rows("select id, username from account")).toEqual([
      { id: created.account.id, username: "minh" },
    ]);
    expect(await rows("select kind from access_event order by kind")).toEqual([
      { kind: "account_created" },
      { kind: "setup_link_issued" },
    ]);
    const grant = expectOk(await testApp(time.clock).redeemSetupLink(created.token, origin()));
    expect(grant.purpose).toBe("first_setup");
    expect(grant.ceremony.accountId).toBe(created.account.id);
  });

  it("given text with quotes, when recorded, then it travels as a parameter and never inside the SQL", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const created = await createOperatorConsole(time.clock).createAccount(
      details("an.oneil", "An O'Neil'); drop table account; --"),
    );

    expect(created.statements.some((statement) => statement.sql.includes("O'Neil"))).toBe(false);
    await apply(created.statements);
    expect(await rows("select display_name from account")).toEqual([
      { display_name: "An O'Neil'); drop table account; --" },
    ]);
  });

  it("given an existing account, when a recovery link's statements run, then the link works in the app", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock);
    const recovery = await createOperatorConsole(time.clock).issueRecoveryLink(account.id);

    await apply(recovery.statements);

    const grant = expectOk(await testApp(time.clock).redeemSetupLink(recovery.token, origin()));
    expect(grant.purpose).toBe("recovery");
  });

  it("given an account signed in on two devices, when revoked, then neither cookie works and the revocation is recorded", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, account);
    const laptop = await seedSession(time.clock, account);

    await apply((await createOperatorConsole(time.clock).revokeSessions(account.id)).statements);

    const app = testApp(time.clock);
    expect(await app.authenticate(phone.cookie)).toMatchObject({ ok: false });
    expect(await app.authenticate(laptop.cookie)).toMatchObject({ ok: false });
    expect(
      await rows("select account_id from access_event where kind = 'sessions_revoked'"),
    ).toEqual([{ account_id: account.id }]);
  });

  it("given a username typed in any case, when the lookup runs, then it finds that account", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const account = await seedAccount(time.clock, "lan", "Lan");
    const lookup = createOperatorConsole(time.clock).findAccount(usernameSchema.parse("Lan"));

    const found = await env.DB.prepare(lookup.query.sql)
      .bind(...lookup.query.params)
      .all();

    expect(lookup.read(found.results)).toEqual({ id: account.id, displayName: "Lan" });
  });

  it("given a username nobody has, when the lookup runs, then it finds nothing", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    await seedAccount(time.clock, "lan", "Lan");
    const lookup = createOperatorConsole(time.clock).findAccount(usernameSchema.parse("minh"));

    const found = await env.DB.prepare(lookup.query.sql)
      .bind(...lookup.query.params)
      .all();

    expect(lookup.read(found.results)).toBeUndefined();
  });
});
