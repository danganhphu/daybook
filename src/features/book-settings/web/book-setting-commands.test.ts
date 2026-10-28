import { describe, expect, it } from "vitest";

import { testApp, testClock, theAuthor } from "@/testing/support/app";

import { bookSettingView, saveQuietAfterDays } from "./book-setting-commands";

function anApp() {
  return testApp(testClock("2026-10-29T03:00:00Z").clock);
}

describe("Settings > Khách lâu không đặt", () => {
  it("given the days typed with spaces around them, when saved, then the screen shows them with the version to send next", async () => {
    const app = anApp();

    expect(await saveQuietAfterDays(app, await theAuthor(), " 30 ", null)).toEqual({
      ok: true,
      value: null,
    });
    expect(await bookSettingView(app)).toEqual({ quietAfterDays: 30, version: 1 });
  });

  it.each(["", "abc", "6", "181", "7.5", "-10", "3 0"])(
    "given %j typed, when saved, then it is refused with the bounds and nothing is stored",
    async (typed) => {
      const app = anApp();

      expect(await saveQuietAfterDays(app, await theAuthor(), typed, null)).toEqual({
        ok: false,
        error: "Nhập số ngày từ 7 đến 180",
      });
      expect(await bookSettingView(app)).toEqual({ quietAfterDays: 21, version: undefined });
    },
  );

  it("given a screen showing the defaults after a change, when saved, then it is told the days changed elsewhere", async () => {
    const app = anApp();
    const by = await theAuthor();
    await saveQuietAfterDays(app, by, "30", null);

    expect(await saveQuietAfterDays(app, by, "45", null)).toEqual({
      ok: false,
      error: "Số ngày vừa được đổi ở nơi khác. Hãy xem lại.",
    });
    expect(await bookSettingView(app)).toEqual({ quietAfterDays: 30, version: 1 });
  });
});
