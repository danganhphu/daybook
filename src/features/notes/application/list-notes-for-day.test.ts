import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { content, testApp, testClock } from "@/testing/support/app";

const day = Temporal.PlainDate.from("2026-10-16");

describe("listNotesForDay", () => {
  it("given notes at different times, when listed, then the newest comes first", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    await app.recordCapture({ content: content("sớm"), source: "web" });
    time.setTo("2026-10-16T05:00:00Z");
    await app.recordCapture({ content: content("muộn"), source: "web" });

    const listed = await app.listNotesForDay(day);

    expect(listed.map((note) => note.content)).toEqual(["muộn", "sớm"]);
  });

  it("given notes recorded in the same millisecond, when listed, then the later one still comes first", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    await app.recordCapture({ content: content("trước"), source: "web" });
    await app.recordCapture({ content: content("sau"), source: "web" });

    const listed = await app.listNotesForDay(day);

    expect(listed.map((note) => note.content)).toEqual(["sau", "trước"]);
  });

  it("given notes either side of midnight in Vietnam, when a day is listed, then only that Vietnamese day counts", async () => {
    const time = testClock("2026-10-15T16:59:59.999Z"); // 23:59:59.999 on the 15th, Vietnam time
    const app = testApp(time.clock);
    await app.recordCapture({ content: content("hôm qua"), source: "web" });
    time.setTo("2026-10-15T17:00:00Z"); // 00:00 on the 16th
    await app.recordCapture({ content: content("hôm nay"), source: "web" });
    time.setTo("2026-10-16T17:00:00Z"); // 00:00 on the 17th
    await app.recordCapture({ content: content("ngày mai"), source: "web" });

    const listed = await app.listNotesForDay(day);

    expect(listed.map((note) => note.content)).toEqual(["hôm nay"]);
  });

  it("given a deleted note, when the day is listed, then it is left out", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({ content: content("xoá"), source: "web" });
    await app.deleteNote(note.id);

    expect(await app.listNotesForDay(day)).toEqual([]);
  });
});
