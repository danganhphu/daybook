import { describe, expect, it } from "vitest";

import { content, testApp, testClock } from "@/testing/support/app";

describe("listNotesForToday", () => {
  it("given the last minute of a Vietnamese day, when today is listed, then it is still that day", async () => {
    const app = testApp(testClock("2026-10-19T16:59:00Z").clock); // 23:59 on the 19th, Vietnam time

    const today = await app.listNotesForToday();

    expect(today.day.toString()).toBe("2026-10-19");
  });

  it("given midnight in Vietnam, when today is listed, then it is the new day, before UTC gets there", async () => {
    const app = testApp(testClock("2026-10-19T17:00:00Z").clock); // 00:00 on the 20th, Vietnam time

    const today = await app.listNotesForToday();

    expect(today.day.toString()).toBe("2026-10-20");
  });

  it("given notes from yesterday and today, when today is listed, then only today's are there", async () => {
    const time = testClock("2026-10-18T03:00:00Z");
    const app = testApp(time.clock);
    await app.recordCapture({ content: content("hôm qua"), source: "web" });
    time.setTo("2026-10-19T03:00:00Z");
    await app.recordCapture({ content: content("hôm nay"), source: "web" });

    const today = await app.listNotesForToday();

    expect(today.notes.map((note) => note.content)).toEqual(["hôm nay"]);
  });
});
