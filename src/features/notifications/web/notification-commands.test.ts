import { describe, expect, it } from "vitest";

import { seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";

import { notificationsView, saveQuietDays } from "./notification-commands";

async function lan() {
  const time = testClock("2026-10-29T03:00:00Z");
  const account = await seedAccount(time.clock, "lan", "Lan");
  const { session } = await seedSession(time.clock, account);

  return { session, app: testApp(time.clock) };
}

describe("Settings > Thông báo, the days for quiet customers", () => {
  it("given nothing changed, when shown, then her notifications count 21 days", async () => {
    const { session, app } = await lan();

    expect((await notificationsView(app, session, undefined)).quietAfterDays).toBe(21);
  });

  it("given 30 typed, when saved, then her screen shows 30 with the version to send next", async () => {
    const { session, app } = await lan();

    expect(await saveQuietDays(app, session, " 30 ", null)).toEqual({ ok: true, value: null });
    const view = await notificationsView(app, session, undefined);

    expect([view.quietAfterDays, view.version]).toEqual([30, 1]);
  });

  it.each(["", "6", "181", "7.5", "abc"])(
    "given %j typed, when saved, then it is refused with the bounds",
    async (typed) => {
      const { session, app } = await lan();

      expect(await saveQuietDays(app, session, typed, null)).toEqual({
        ok: false,
        error: "Nhập số ngày từ 7 đến 180",
      });
    },
  );

  it("given her times changed in another tab, when the days are saved from this one, then it is told they changed elsewhere", async () => {
    const { session, app } = await lan();
    await saveQuietDays(app, session, "30", null);

    expect(await saveQuietDays(app, session, "45", null)).toEqual({
      ok: false,
      error: "Số ngày vừa được đổi ở nơi khác. Hãy xem lại.",
    });
  });
});
