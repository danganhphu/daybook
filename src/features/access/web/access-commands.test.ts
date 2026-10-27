import { describe, expect, it } from "vitest";

import { accessErrorMessages } from "@/features/access/application/access-errors";
import { usernameRule } from "@/features/access/domain/account-limits";
import { origin } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { seedPasskeyAccount } from "@/testing/support/passkeys";
import { expectOk } from "@/testing/support/result";

import { beginSetup, nameAccount, resumeSetup } from "./access-commands";

async function anOpenedInvite() {
  const time = testClock("2026-10-22T01:00:00Z");
  const lan = await seedPasskeyAccount(time, "lan");
  const app = testApp(time.clock);
  const issued = expectOk(await app.issueInvite(lan.session, origin()));
  const begun = expectOk(await beginSetup(app, issued.token, origin()));

  return { app, begun };
}

describe("an invite's setup, as the page sees it", () => {
  it("given an invite, when it is opened, then the first step is the name, with no prompt yet", async () => {
    const { begun } = await anOpenedInvite();

    expect(begun.view).toEqual({ purpose: "invite", step: { kind: "name" } });
  });

  it("given both fields wrong, when sent, then each field gets its own sentence and nothing is made", async () => {
    const { app, begun } = await anOpenedInvite();

    expect(
      await nameAccount(app, {
        ceremonyCookie: begun.ceremonyCookie,
        displayName: "   ",
        username: "Có Dấu",
        origin: origin(),
      }),
    ).toEqual({
      ok: false,
      error: { displayName: "Chưa nhập tên", username: `Tên đăng nhập ${usernameRule}` },
    });
    expect(expectOk(await resumeSetup(app, begun.ceremonyCookie)).step).toEqual({ kind: "name" });
  });

  it("given a username that is taken, when sent, then the sentence goes under the username", async () => {
    const { app, begun } = await anOpenedInvite();

    expect(
      await nameAccount(app, {
        ceremonyCookie: begun.ceremonyCookie,
        displayName: "Minh",
        username: "lan",
        origin: origin(),
      }),
    ).toEqual({ ok: false, error: { username: accessErrorMessages.username_taken } });
  });

  it("given a good name, when sent, then the passkey prompt comes back for the new account, and a reload carries on from there", async () => {
    const { app, begun } = await anOpenedInvite();

    const options = expectOk(
      await nameAccount(app, {
        ceremonyCookie: begun.ceremonyCookie,
        displayName: "Minh",
        username: "Minh",
        origin: origin(),
      }),
    );

    expect(options.user).toMatchObject({ name: "minh", displayName: "Minh" });
    expect(expectOk(await resumeSetup(app, begun.ceremonyCookie)).step.kind).toBe("passkey");
  });

  it("given no ceremony cookie, when the page resumes, then the link is said to be unusable", async () => {
    const time = testClock("2026-10-22T01:00:00Z");

    expect(await resumeSetup(testApp(time.clock), undefined)).toEqual({
      ok: false,
      error: accessErrorMessages.setup_link_unusable,
    });
  });
});
