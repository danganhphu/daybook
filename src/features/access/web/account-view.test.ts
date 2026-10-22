import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { passkeyTerm } from "@/features/access/application/access-terms";
import { sessionIdSchema } from "@/features/access/domain/session";
import { origin, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { seedPasskeyAccount } from "@/testing/support/passkeys";
import { seedPassword } from "@/testing/support/passwords";
import { expectOk } from "@/testing/support/result";

import { accessCopy } from "./access-copy";
import { formatMoment, toAccountView } from "./account-view";

async function viewAfterSetup() {
  const time = testClock("2026-10-22T01:00:00Z");
  const seeded = await seedPasskeyAccount(time);
  const app = testApp(time.clock);

  return { time, seeded, app };
}

describe("formatMoment", () => {
  it("given an instant, when formatted, then it reads in Vietnam's time, hour first", () => {
    expect(formatMoment(Temporal.Instant.from("2026-10-22T09:02:00Z"))).toBe("16:02 22/10");
  });
});

describe("toAccountView", () => {
  it("given an account just set up, when shown, then this device is marked and the passkey says when it came", async () => {
    const { seeded, app } = await viewAfterSetup();

    const view = toAccountView(await app.accountOverview(seeded.account.id), seeded.session.id);

    expect(view.displayName).toBe("Lan");
    expect(view.username).toBe("lan");
    expect(view.devices).toEqual([
      expect.objectContaining({
        id: seeded.session.id,
        detail: accessCopy.thisDevice,
        current: true,
      }),
    ]);
    expect(view.passkeys).toHaveLength(1);
    expect(view.password).toEqual({ kind: "none" });
  });

  it("given another device is looking, when shown, then no device is this one and each says when it was last used", async () => {
    const { seeded, app } = await viewAfterSetup();

    const view = toAccountView(
      await app.accountOverview(seeded.account.id),
      // A session id that is not in the list
      sessionIdSchema.parse(crypto.randomUUID()),
    );

    expect(view.devices.map(({ current, detail }) => ({ current, detail }))).toEqual([
      { current: false, detail: "Dùng lần cuối 08:00 22/10" },
    ]);
  });

  it("given a password, when shown, then the row says when it was changed", async () => {
    const { time, seeded, app } = await viewAfterSetup();
    await seedPassword(time, seeded.account);

    const view = toAccountView(await app.accountOverview(seeded.account.id), seeded.session.id);

    expect(view.password).toEqual({ kind: "set", locked: false, detail: "Đổi lúc 08:00 22/10" });
  });

  it("given a passkey sign-in in the log, when shown, then the activity names the way in", async () => {
    const { seeded, app } = await viewAfterSetup();

    const view = toAccountView(await app.accountOverview(seeded.account.id), seeded.session.id);

    expect(view.activity.map(({ title }) => title)).toContain(`Đăng nhập bằng ${passkeyTerm}`);
  });

  it("given a recovery link Lan made for Minh, when each looks, then each reads it from their own side", async () => {
    const { seeded: lan, app } = await viewAfterSetup();
    const minh = await seedAccount(testClock("2026-10-22T01:00:00Z").clock, "minh", "Minh");
    const minhSession = await seedSession(testClock("2026-10-22T01:00:00Z").clock, minh);
    expectOk(await app.issueRecoveryLink(lan.session, minh.id, origin()));

    const lanSees = toAccountView(await app.accountOverview(lan.account.id), lan.session.id);
    const minhSees = toAccountView(await app.accountOverview(minh.id), minhSession.session.id);

    expect(lanSees.activity[0]?.title).toBe("Tạo link khôi phục cho Minh");
    expect(minhSees.activity[0]?.title).toBe("Lan tạo link khôi phục");
  });

  it("given the people who share the book, when listed, then the viewer is marked and each says how they stand", async () => {
    const { seeded: lan, app } = await viewAfterSetup();
    await seedAccount(testClock("2026-10-22T01:00:00Z").clock, "minh", "Minh");

    const view = toAccountView(await app.accountOverview(lan.account.id), lan.session.id);

    expect(view.people.map(({ title, detail, isYou }) => ({ title, detail, isYou }))).toEqual([
      { title: "Lan (bạn)", detail: "lan, đăng nhập lần cuối 08:00 22/10", isYou: true },
      { title: "Minh", detail: "minh, chưa có cách đăng nhập", isYou: false },
    ]);
  });

  it("given everything an account has, when shown, then nothing secret reaches the page", async () => {
    const { time, seeded, app } = await viewAfterSetup();
    await seedPassword(time, seeded.account);

    const shown = JSON.stringify(
      toAccountView(await app.accountOverview(seeded.account.id), seeded.session.id),
    );

    for (const secret of ["verifier", "salt", "publicKey", "userHandle", "credentialId"]) {
      expect(shown).not.toContain(secret);
    }
    expect(shown).not.toContain(seeded.stored.credentialId);
    expect(shown).not.toContain(seeded.account.userHandle);
  });
});
