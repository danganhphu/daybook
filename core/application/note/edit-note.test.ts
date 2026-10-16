import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { content, testApp, testClock } from "../../../tests/support/app";
import { expectOk } from "../../../tests/support/result";
import { noteIdSchema } from "../../domain/note/note";

describe("editNote", () => {
  it("given a live note, when edited, then it carries the new words and only updatedAt moves", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await app.recordCapture({ content: content("gel tê x2"), source: "web" });
    time.setTo("2026-10-16T03:00:00Z");

    const edited = expectOk(await app.editNote({ id: note.id, content: content("gel tê x3") }));

    expect(edited.content).toBe("gel tê x3");
    expect(edited.createdAt.toString()).toBe("2026-10-16T01:00:00Z");
    expect(edited.updatedAt.toString()).toBe("2026-10-16T03:00:00Z");
  });

  it("given a note that was edited, when its capture is read, then her original words are still there", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({ content: content("gel tê x2"), source: "web" });

    await app.editNote({ id: note.id, content: content("gel tê x3") });
    const capture = await env.DB.prepare("select content from capture where id = ?")
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({ content: "gel tê x2" });
  });

  it("given a deleted note, when edited, then it refuses with note_deleted", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({ content: content("cũ"), source: "web" });
    await app.deleteNote(note.id);

    expect(await app.editNote({ id: note.id, content: content("mới") })).toEqual({
      ok: false,
      error: "note_deleted",
    });
  });

  it("given an id that matches no note, when edited, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(await app.editNote({ id: unknown, content: content("x") })).toEqual({
      ok: false,
      error: "note_not_found",
    });
  });
});
