import { describe, expect, it } from "vitest";

import { formatCeremonyCookie } from "@/features/access/application/ceremony-cookie";
import { newSecretToken } from "@/features/access/application/secret-tokens";
import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { origin, rows, seedAccount, seedSetupLink } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { anAuthenticator, ceremonyIdIn, seedPasskeyAccount } from "@/testing/support/passkeys";
import { expectOk } from "@/testing/support/result";

const authenticator = anAuthenticator();

type Time = ReturnType<typeof testClock>;

const newcomer = {
  displayName: displayNameSchema.parse("Minh"),
  username: usernameSchema.parse("minh"),
};

// Past the five-minute window: the session still works, but no longer counts as a recent sign-in
function later(time: Time) {
  time.setTo("2026-10-22T01:05:00Z");
}

// Lan, signed in just now, invites someone; the link is opened in another browser
async function anOpenedInvite(time: Time) {
  const lan = await seedPasskeyAccount(time, "lan");
  const app = testApp(time.clock);
  const issued = expectOk(await app.issueInvite(lan.session, origin()));
  const grant = expectOk(await app.redeemSetupLink(issued.token, origin("198.51.100.4")));

  return { lan, app, issued, ceremonyCookie: grant.cookie };
}

describe("inviting someone", () => {
  it("given a fresh session, when an invite is made, then it is an invite by this user with no account yet, and logged", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");

    const issued = expectOk(await testApp(time.clock).issueInvite(lan.session, origin()));

    expect(issued.link).toMatchObject({
      purpose: "invite",
      createdBy: lan.account.id,
      accountId: undefined,
    });
    expect(
      await rows(
        "select account_id, actor_id from access_event where kind = 'setup_link_issued' and json_extract(detail, '$.purpose') = 'invite'",
      ),
    ).toEqual([{ account_id: null, actor_id: lan.account.id }]);
  });

  it("given a session past the window, when an invite is made, then step-up is asked and no link exists", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    later(time);

    expect(await testApp(time.clock).issueInvite(lan.session, origin())).toEqual({
      ok: false,
      error: "step_up_required",
    });
    expect(await rows("select id from setup_link where purpose = 'invite'")).toEqual([]);
  });

  it("given an opened invite, when the setup resumes, then it waits for a name and offers no passkey prompt yet", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { app, ceremonyCookie } = await anOpenedInvite(time);

    expect(expectOk(await app.resumeSetup(ceremonyCookie))).toEqual({
      purpose: "invite",
      next: "name",
    });
    expect(await app.startPasskeySetup(ceremonyCookie)).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given an opened invite, when the newcomer names the account and makes a passkey, then they are signed in to it", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { lan, app, ceremonyCookie } = await anOpenedInvite(time);

    const account = expectOk(
      await app.nameInvitedAccount({ ceremonyCookie, details: newcomer, origin: origin() }),
    );
    expect(expectOk(await app.resumeSetup(ceremonyCookie)).next).toBe("passkey");
    const options = expectOk(await app.startPasskeySetup(ceremonyCookie));
    expect(options.user).toMatchObject({ name: "minh", displayName: "Minh" });
    const { response } = await authenticator.create(options);
    const finished = expectOk(
      await app.finishPasskeySetup({
        ceremonyCookie,
        response,
        origin: origin(),
        replacing: undefined,
      }),
    );

    expect(finished.session.accountId).toBe(account.id);
    expect(
      await rows("select account_id, actor_id from access_event where kind = 'account_created'"),
    ).toEqual([{ account_id: account.id, actor_id: lan.account.id }]);
    // The link row is redeemed and stays as it was; the ceremony carried the account
    expect(await rows("select account_id from setup_link where purpose = 'invite'")).toEqual([
      { account_id: null },
    ]);
  });

  it("given a username someone has, when the newcomer picks it, then it is refused and no account is made", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { app, ceremonyCookie } = await anOpenedInvite(time);

    expect(
      await app.nameInvitedAccount({
        ceremonyCookie,
        details: { ...newcomer, username: usernameSchema.parse("lan") },
        origin: origin(),
      }),
    ).toEqual({ ok: false, error: "username_taken" });
    expect(await rows("select username from account")).toEqual([{ username: "lan" }]);
  });

  it("given an account named already, when the name is sent again, then the same account comes back and no second one is made", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { app, ceremonyCookie } = await anOpenedInvite(time);

    const first = expectOk(
      await app.nameInvitedAccount({ ceremonyCookie, details: newcomer, origin: origin() }),
    );
    const again = expectOk(
      await app.nameInvitedAccount({
        ceremonyCookie,
        details: { ...newcomer, username: usernameSchema.parse("someone.else") },
        origin: origin(),
      }),
    );

    expect(again.id).toBe(first.id);
    expect(await rows("select username from account order by username")).toEqual([
      { username: "lan" },
      { username: "minh" },
    ]);
  });

  it("given an invite opened once, when it is opened again, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { app, issued } = await anOpenedInvite(time);

    expect(await app.redeemSetupLink(issued.token, origin())).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given an invite older than ten minutes, when it is opened, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const issued = expectOk(await testApp(time.clock).issueInvite(lan.session, origin()));
    time.setTo("2026-10-22T01:10:00Z");

    expect(await testApp(time.clock).redeemSetupLink(issued.token, origin())).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given an opened invite whose setup ran out, when the newcomer names the account, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { ceremonyCookie } = await anOpenedInvite(time);
    time.setTo("2026-10-22T01:10:00Z");

    expect(
      await testApp(time.clock).nameInvitedAccount({
        ceremonyCookie,
        details: newcomer,
        origin: origin(),
      }),
    ).toEqual({ ok: false, error: "setup_link_unusable" });
    expect(await rows("select username from account")).toEqual([{ username: "lan" }]);
  });

  it("given a setup that is not an invite, when a name is sent for it, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const { token } = await seedSetupLink(time.clock, {
      purpose: "first_setup",
      accountId: minh.id,
    });
    const app = testApp(time.clock);
    const grant = expectOk(await app.redeemSetupLink(token, origin()));

    expect(
      await app.nameInvitedAccount({
        ceremonyCookie: grant.cookie,
        details: { ...newcomer, username: usernameSchema.parse("minh2") },
        origin: origin(),
      }),
    ).toEqual({ ok: false, error: "setup_link_unusable" });
  });

  it("given the invite's ceremony with a forged binding, when a name is sent, then it is refused", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { app, ceremonyCookie } = await anOpenedInvite(time);
    const forged = formatCeremonyCookie({
      ceremonyId: ceremonyIdIn(ceremonyCookie),
      binding: newSecretToken(webCryptoSecrets),
    });

    expect(
      await app.nameInvitedAccount({ ceremonyCookie: forged, details: newcomer, origin: origin() }),
    ).toEqual({ ok: false, error: "setup_link_unusable" });
  });
});

describe("a recovery link for the other user", () => {
  it("given a fresh session, when a link is made for the other account, then it is a recovery for them by this user, in both activities", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const app = testApp(time.clock);

    const issued = expectOk(await app.issueRecoveryLink(lan.session, minh.id, origin()));

    expect(issued.link).toMatchObject({
      purpose: "recovery",
      accountId: minh.id,
      createdBy: lan.account.id,
    });
    const overviews = await Promise.all(
      [lan.account, minh].map((account) => app.accountOverview(account.id)),
    );
    for (const { activity } of overviews) {
      expect(
        activity.filter(
          (event) => event.kind === "setup_link_issued" && event.detail?.["purpose"] === "recovery",
        ),
      ).toHaveLength(1);
    }
  });

  it("given a session past the window, when a link is asked for, then step-up comes first, whatever the account", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    later(time);

    expect(await testApp(time.clock).issueRecoveryLink(lan.session, "not-an-id", origin())).toEqual(
      {
        ok: false,
        error: "step_up_required",
      },
    );
  });

  it.each([
    ["this user's own account", "self"],
    ["an account that does not exist", "019a0000-0000-7000-8000-00000000dead"],
    ["something that is not an id", "minh"],
  ])("given %s, when a link is asked for, then nothing is found", async (_, target) => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");

    expect(
      await testApp(time.clock).issueRecoveryLink(
        lan.session,
        target === "self" ? lan.account.id : target,
        origin(),
      ),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await rows("select id from setup_link where purpose = 'recovery'")).toEqual([]);
  });

  it("given a recovery link used on a new phone, when the passkey is made, then their other devices are signed out and their old passkey stays", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const lan = await seedPasskeyAccount(time, "lan");
    const minh = await seedPasskeyAccount(time, "minh");
    const app = testApp(time.clock);
    const issued = expectOk(await app.issueRecoveryLink(lan.session, minh.account.id, origin()));
    const grant = expectOk(await app.redeemSetupLink(issued.token, origin("198.51.100.4")));
    const options = expectOk(await app.startPasskeySetup(grant.cookie));
    const { response } = await anAuthenticator().create(options);

    const finished = expectOk(
      await app.finishPasskeySetup({
        ceremonyCookie: grant.cookie,
        response,
        origin: origin("198.51.100.4"),
        replacing: undefined,
      }),
    );

    expect(await rows("select id from session where account_id = ?", minh.account.id)).toEqual([
      { id: finished.session.id },
    ]);
    expect(await rows("select id from passkey where account_id = ?", minh.account.id)).toHaveLength(
      2,
    );
    // Lan's own session is not touched
    expect(await rows("select id from session where id = ?", lan.session.id)).toHaveLength(1);
  });
});

describe("the people list", () => {
  it("given an account signed in and one invited but stopped half-way, when listed, then each says when it last signed in and whether it has a way in", async () => {
    const time = testClock("2026-10-22T01:00:00Z");
    const { lan, app, ceremonyCookie } = await anOpenedInvite(time);
    const minh = expectOk(
      await app.nameInvitedAccount({ ceremonyCookie, details: newcomer, origin: origin() }),
    );

    const { people } = await app.accountOverview(lan.account.id);

    expect(
      people.map((person) => ({
        username: person.account.username,
        signedIn: person.lastSignInAt?.toString(),
        hasWayIn: person.hasWayIn,
      })),
    ).toEqual([
      { username: "lan", signedIn: "2026-10-22T01:00:00Z", hasWayIn: true },
      { username: minh.username, signedIn: undefined, hasWayIn: false },
    ]);
  });
});
