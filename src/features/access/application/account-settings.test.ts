import { describe, expect, it } from "vitest";

import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { anAuthenticator, seedPasskeyAccount } from "@/testing/support/passkeys";
import { seedPassword } from "@/testing/support/passwords";
import { expectOk } from "@/testing/support/result";

const stepUp = { ok: false, error: "step_up_required" };
const authenticator = anAuthenticator();

type Time = ReturnType<typeof testClock>;

// Past the five-minute window: the session still works, but no longer counts as a recent sign-in
function later(time: Time) {
  time.setTo("2026-10-22T01:05:00Z");
}

async function addAPasskey(
  time: Time,
  session: Parameters<ReturnType<typeof testApp>["startAddingPasskey"]>[0],
) {
  const app = testApp(time.clock);
  const prompt = expectOk(await app.startAddingPasskey(session));
  const { response } = await authenticator.create(prompt.options);

  return app.finishAddingPasskey(session, {
    ceremonyCookie: prompt.ceremonyCookie,
    response,
    origin: origin(),
  });
}

describe("adding a passkey", () => {
  it("given a fresh session, when another passkey is made, then the account has two and the add is logged", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session, stored } = await seedPasskeyAccount(time);

    const prompt = expectOk(await testApp(time.clock).startAddingPasskey(session));
    expect(prompt.options.excludeCredentials?.map(({ id }) => id)).toEqual([stored.credentialId]);
    const added = expectOk(await addAPasskey(time, session));

    expect(added.accountId).toBe(account.id);
    expect(await rows("select id from passkey")).toHaveLength(2);
    expect(
      await rows("select count(*) as count from access_event where kind = 'passkey_added'"),
    ).toEqual([{ count: 2 }]);
  });

  it("given a session past the window, when a passkey is to be added, then step-up is asked", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await seedPasskeyAccount(time);
    later(time);

    expect(await testApp(time.clock).startAddingPasskey(session)).toEqual(stepUp);
  });

  it("given another account's prompt, when its answer is sent with this session, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");
    const app = testApp(time.clock);
    const prompt = expectOk(await app.startAddingPasskey(lan.session));
    const { response } = await authenticator.create(prompt.options);

    expect(
      await app.finishAddingPasskey(minh.session, {
        ceremonyCookie: prompt.ceremonyCookie,
        response,
        origin: origin(),
      }),
    ).toEqual({ ok: false, error: "passkey_not_accepted" });
  });
});

describe("removing a passkey", () => {
  it("given two passkeys, when one is removed, then the other stays, the devices it signed in are signed out, and this one keeps going", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session, stored } = await seedPasskeyAccount(time);
    // Another phone signed in with the passkey being removed, and a laptop with the password
    await seedSession(time.clock, account, { passkey: stored.id });
    const { session: laptop } = await seedSession(time.clock, account);
    expectOk(await addAPasskey(time, session));

    expectOk(await testApp(time.clock).removePasskey(session, stored.id, origin()));

    expect(await rows("select id from passkey where id = ?", stored.id)).toEqual([]);
    expect(await rows("select id, passkey_id from session order by id")).toEqual(
      [
        { id: session.id, passkey_id: null },
        { id: laptop.id, passkey_id: null },
      ].toSorted((a, b) => (a.id < b.id ? -1 : 1)),
    );
    expect(await rows("select kind from access_event where kind = 'passkey_removed'")).toHaveLength(
      1,
    );
  });

  it("given the only passkey and no password, when it is to be removed, then it stays: it is the last way in", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session, stored } = await seedPasskeyAccount(time);

    expect(await testApp(time.clock).removePasskey(session, stored.id, origin())).toEqual({
      ok: false,
      error: "last_way_in",
    });
  });

  it("given the only passkey and a password, when it is removed, then the password is the way in", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session, stored } = await seedPasskeyAccount(time);
    await seedPassword(time, account);

    expect(await testApp(time.clock).removePasskey(session, stored.id, origin())).toEqual({
      ok: true,
      value: null,
    });
  });

  it("given the only passkey and a locked password, when it is to be removed, then it stays", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session, stored } = await seedPasskeyAccount(time);
    await seedPassword(time, account);
    await rows("update password set locked_at = 1");

    expect(await testApp(time.clock).removePasskey(session, stored.id, origin())).toEqual({
      ok: false,
      error: "last_way_in",
    });
  });

  it("given another account's passkey, when this session tries to remove it, then nothing is found", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");

    expect(await testApp(time.clock).removePasskey(lan.session, minh.stored.id, origin())).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("given a session past the window, when a passkey is to be removed, then step-up is asked", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session, stored } = await seedPasskeyAccount(time);
    later(time);

    expect(await testApp(time.clock).removePasskey(session, stored.id, origin())).toEqual(stepUp);
  });
});

describe("step-up after a password sign-in", () => {
  it("given an account with a passkey and a password sign-in a minute old, when a security setting is asked for, then a passkey is: a password alone adds no passkey", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account } = await seedPasskeyAccount(time);
    await seedPassword(time, account);
    const { session: phished } = await seedSession(time.clock, account);
    const app = testApp(time.clock);

    expect(await app.startAddingPasskey(phished)).toEqual(stepUp);
    expect(await app.beginPasswordChange(phished)).toEqual(stepUp);
    expect(await app.issueInvite(phished, origin())).toEqual(stepUp);
  });

  it("given an account with no passkey, when its fresh password sign-in asks for a passkey, then it may add its first", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const account = await seedAccount(time.clock);
    await seedPassword(time, account);
    const { session } = await seedSession(time.clock, account);

    expect(await testApp(time.clock).startAddingPasskey(session)).toMatchObject({ ok: true });
  });
});

describe("names", () => {
  it("given a new display name, when changed, then it is stored without asking for step-up", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session } = await seedPasskeyAccount(time);
    later(time);

    const renamed = await testApp(time.clock).changeDisplayName(
      session,
      displayNameSchema.parse("Lan Anh"),
      origin(),
    );

    expect(renamed.displayName).toBe("Lan Anh");
    expect(await rows("select display_name from account where id = ?", account.id)).toEqual([
      { display_name: "Lan Anh" },
    ]);
  });

  it("given a free username and a fresh session, when changed, then the password signs in under the new name", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session } = await seedPasskeyAccount(time);
    const { key } = await seedPassword(time, account);
    const app = testApp(time.clock);

    expectOk(await app.changeUsername(session, usernameSchema.parse("lananh"), origin()));

    const prompt = expectOk(await app.beginPasswordSignIn("lananh", origin()));
    expect(
      await app.finishPasswordSignIn({
        ceremonyCookie: prompt.ceremonyCookie,
        key,
        origin: origin(),
        current: undefined,
      }),
    ).toMatchObject({ ok: true });
  });

  it("given a username someone else has, when changed to it, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await seedPasskeyAccount(time, "lan");
    await seedPasskeyAccount(time, "minh");

    expect(
      await testApp(time.clock).changeUsername(session, usernameSchema.parse("minh"), origin()),
    ).toEqual({ ok: false, error: "username_taken" });
  });

  it("given a session past the window, when the username is to change, then step-up is asked", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { session } = await seedPasskeyAccount(time);
    later(time);

    expect(
      await testApp(time.clock).changeUsername(session, usernameSchema.parse("lananh"), origin()),
    ).toEqual(stepUp);
  });
});

describe("ending another device's session", () => {
  it("given another device signed in, when it is ended from here, then only that session goes", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account, session } = await seedPasskeyAccount(time);
    const { session: phone } = await seedSession(time.clock, account);

    expectOk(await testApp(time.clock).endSession(session, phone.id, origin()));

    expect(await rows("select id from session")).toEqual([{ id: session.id }]);
  });

  it.each([
    ["this very session", "self"],
    ["another account's session", "other"],
  ])("given %s, when it is to be ended from here, then nothing is found", async (_, whose) => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");
    const target = whose === "self" ? lan.session.id : minh.session.id;

    expect(await testApp(time.clock).endSession(lan.session, target, origin())).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("signing out the other person's devices", () => {
  it("given the other person's phone lost, when this user signs out every device of theirs, then all theirs end, this one stays, and it is logged for both", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");
    await seedSession(time.clock, minh.account);

    expect(
      await testApp(time.clock).endPersonSessions(lan.session, minh.account.id, origin()),
    ).toEqual({ ok: true, value: 2 });

    expect(await rows("select id from session")).toEqual([{ id: lan.session.id }]);
    expect(
      await rows(
        "select account_id, actor_id, detail from access_event where kind = 'sessions_revoked'",
      ),
    ).toEqual([
      {
        account_id: minh.account.id,
        actor_id: lan.account.id,
        detail: JSON.stringify({ by: "other_user", ended: "2" }),
      },
    ]);
    expect(await rows("select id from passkey where id = ?", minh.stored.id)).toHaveLength(1);
  });

  it("given this user's own account, when its devices are to be signed out this way, then nothing is found", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");

    expect(
      await testApp(time.clock).endPersonSessions(lan.session, lan.account.id, origin()),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("given a session past the window, when the other person's devices are to be signed out, then step-up is asked", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");
    later(time);

    expect(
      await testApp(time.clock).endPersonSessions(lan.session, minh.account.id, origin()),
    ).toEqual(stepUp);
    expect(await rows("select id from session where account_id = ?", minh.account.id)).toHaveLength(
      1,
    );
  });
});

describe("accountOverview", () => {
  it("given an account with a password, when read, then it says so without the salt or verifier", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { account } = await seedPasskeyAccount(time);
    await seedPassword(time, account);

    const overview = await testApp(time.clock).accountOverview(account.id);

    expect(overview.password).toEqual({ kind: "set", locked: false, changedAt: time.clock() });
    expect(JSON.stringify(overview)).not.toMatch(/verifier|salt/);
    expect(overview.passkeys).toHaveLength(1);
    expect(overview.activity.at(0)?.kind).toBe("password_set");
  });
});
