import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { content, testApp, testClock, theAuthor } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

describe("editNote", () => {
  it("given a live note, when edited, then it carries the new words and only updatedAt moves", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await app.recordCapture({
      content: content("giấy in x2"),
      source: "web",
      authorId: await theAuthor(),
    });
    time.setTo("2026-10-16T03:00:00Z");

    const edited = expectOk(await app.editNote({ id: note.id, content: content("giấy in x3") }));

    expect(edited.content).toBe("giấy in x3");
    expect(edited.createdAt.toString()).toBe("2026-10-16T01:00:00Z");
    expect(edited.updatedAt.toString()).toBe("2026-10-16T03:00:00Z");
  });

  it("given a note that was edited, when its capture is read, then the original words are still there", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({
      content: content("giấy in x2"),
      source: "web",
      authorId: await theAuthor(),
    });

    await app.editNote({ id: note.id, content: content("giấy in x3") });
    const capture = await env.DB.prepare("select content from capture where id = ?")
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({ content: "giấy in x2" });
  });

  it("given a deleted note, when edited, then it refuses with note_deleted", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await app.recordCapture({
      content: content("cũ"),
      source: "web",
      authorId: await theAuthor(),
    });
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
