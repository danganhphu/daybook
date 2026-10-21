import { describe, expect, it } from "vitest";

import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";

describe("endOtherSessions", () => {
  it("given a fresh sign-in, when other devices are signed out, then only this account's other sessions end", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const other = await seedAccount(time.clock, "minh", "Minh");
    const oldPhone = await seedSession(time.clock, lan);
    const laptop = await seedSession(time.clock, lan);
    const someoneElse = await seedSession(time.clock, other);
    time.setTo("2026-10-21T01:10:00Z");
    const here = await seedSession(time.clock, lan);
    time.setTo("2026-10-21T01:12:00Z");
    const app = testApp(time.clock);

    expect(await app.endOtherSessions(here.session, origin())).toEqual({ ok: true, value: 2 });

    expect(await app.authenticate(here.cookie)).toMatchObject({ ok: true });
    expect(await app.authenticate(oldPhone.cookie)).toMatchObject({ ok: false });
    expect(await app.authenticate(laptop.cookie)).toMatchObject({ ok: false });
    expect(await app.authenticate(someoneElse.cookie)).toMatchObject({ ok: true });
  });

  it("given a sign-in 5 minutes ago, when other devices are signed out, then it asks to confirm first and ends nothing", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const lan = await seedAccount(time.clock);
    await seedSession(time.clock, lan);
    const here = await seedSession(time.clock, lan);
    time.setTo("2026-10-21T01:05:00Z");

    expect(await testApp(time.clock).endOtherSessions(here.session, origin())).toEqual({
      ok: false,
      error: "step_up_required",
    });
    expect(await rows("select id from session")).toHaveLength(2);
  });
});

describe("listSessions", () => {
  it("given an account on several devices, when listed, then they come most recently used first, and only its own", async () => {
    const time = testClock("2026-10-21T01:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const phone = await seedSession(time.clock, lan, {
      from: origin("203.0.113.7", "Safari trên iPhone"),
    });
    time.setTo("2026-10-21T02:00:00Z");
    const laptop = await seedSession(time.clock, lan, {
      from: origin("203.0.113.8", "Chrome trên Windows"),
    });
    await seedSession(time.clock, await seedAccount(time.clock, "minh", "Minh"));

    const listed = await testApp(time.clock).listSessions(lan.id);

    expect(listed.map((session) => session.id)).toEqual([laptop.session.id, phone.session.id]);
    expect(listed.map((session) => session.deviceLabel)).toEqual([
      "Chrome trên Windows",
      "Safari trên iPhone",
    ]);
  });
});
