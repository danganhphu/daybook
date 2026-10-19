import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { content, testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

describe("restoreNote", () => {
  it("given a deleted note, when restored, then it is back unchanged and in its original place", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    await app.recordCapture({ content: content("một"), source: "web" });
    time.setTo("2026-10-16T02:00:00Z");
    const second = await app.recordCapture({ content: content("hai"), source: "web" });
    time.setTo("2026-10-16T03:00:00Z");
    await app.recordCapture({ content: content("ba"), source: "web" });
    await app.deleteNote(second.id);

    const restored = expectOk(await app.restoreNote(second.id));
    const listed = await app.listNotesForDay(Temporal.PlainDate.from("2026-10-16"));

    expect(restored).toEqual(second);
    expect(listed.map((note) => note.content)).toEqual(["ba", "hai", "một"]);
  });

  it("given a live note, when restored, then it refuses with note_not_deleted", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({ content: content("còn"), source: "web" });

    expect(await app.restoreNote(note.id)).toEqual({ ok: false, error: "note_not_deleted" });
  });

  it("given an id that matches no note, when restored, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(await app.restoreNote(unknown)).toEqual({ ok: false, error: "note_not_found" });
  });
});
