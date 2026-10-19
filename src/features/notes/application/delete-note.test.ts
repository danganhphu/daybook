import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { content, testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

describe("deleteNote", () => {
  it("given a live note, when deleted, then it is marked deleted at that time", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await app.recordCapture({ content: content("xoá"), source: "web" });
    time.setTo("2026-10-16T01:05:00Z");

    const deleted = expectOk(await app.deleteNote(note.id));

    expect(deleted.status).toBe("deleted");
    expect(deleted.deletedAt.toString()).toBe("2026-10-16T01:05:00Z");
  });

  it("given a deleted note, when deleted again, then nothing changes, not even the time it was deleted", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await app.recordCapture({ content: content("xoá"), source: "web" });
    time.setTo("2026-10-16T01:05:00Z");
    await app.deleteNote(note.id);
    time.setTo("2026-10-16T01:06:00Z");

    const again = expectOk(await app.deleteNote(note.id));

    expect(again.deletedAt.toString()).toBe("2026-10-16T01:05:00Z");
  });

  it("given an id that matches no note, when deleted, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(await app.deleteNote(unknown)).toEqual({ ok: false, error: "note_not_found" });
  });
});
