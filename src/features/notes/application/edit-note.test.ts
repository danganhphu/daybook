import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { versionSchema } from "@/shared/domain/audit";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
  thePartner,
} from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

describe("editNote", () => {
  it("given a live note, when the other person edits it, then the words, editor and version change, not the creation", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await recordNote(app, "thuốc tê x2");
    const partner = await thePartner();
    time.setTo("2026-10-16T03:00:00Z");

    const edited = expectOk(
      await app.editNote({ ...changeOf(note, partner), content: content("thuốc tê x3") }),
    );

    expect(edited.content).toBe("thuốc tê x3");
    expect(edited.audit.createdAt.toString()).toBe("2026-10-16T01:00:00Z");
    expect(edited.audit.createdBy).toBe(await theAuthor());
    expect(edited.audit.updatedAt.toString()).toBe("2026-10-16T03:00:00Z");
    expect(edited.audit.updatedBy).toBe(partner);
    expect(edited.audit.version).toBe(2);
    expect(await app.listNotesForDay(app.today())).toEqual([edited]);
  });

  it("given a note that was edited, when its capture is read, then the original words are still there", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await recordNote(app, "thuốc tê x2");

    await app.editNote({ ...changeOf(note, await theAuthor()), content: content("thuốc tê x3") });
    const capture = await env.DB.prepare("select content from capture where id = ?")
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({ content: "thuốc tê x2" });
  });

  it("given a note changed on another device since it was shown, when edited, then it is refused and the other change stays", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const shown = await recordNote(app, "thuốc tê x2");
    await app.editNote({ ...changeOf(shown, await thePartner()), content: content("thuốc tê x5") });

    const stale = await app.editNote({
      ...changeOf(shown, await theAuthor()),
      content: content("thuốc tê x3"),
    });

    expect(stale).toEqual({ ok: false, error: "note_changed_elsewhere" });
    expect((await app.listNotesForDay(app.today())).map((note) => note.content)).toEqual([
      "thuốc tê x5",
    ]);
  });

  it("given a version newer than the stored one, when edited, then it is refused", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await recordNote(app, "cũ");

    expect(
      await app.editNote({
        id: note.id,
        by: await theAuthor(),
        shown: versionSchema.parse(2),
        content: content("mới"),
      }),
    ).toEqual({ ok: false, error: "note_changed_elsewhere" });
  });

  it("given a deleted note, when edited at the version the deletion left, then it refuses with note_deleted", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const author = await theAuthor();
    const note = await recordNote(app, "cũ");
    const deleted = expectOk(await app.deleteNote(changeOf(note, author)));

    expect(await app.editNote({ ...changeOf(deleted, author), content: content("mới") })).toEqual({
      ok: false,
      error: "note_deleted",
    });
  });

  it("given an id that matches no note, when edited, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(
      await app.editNote({
        id: unknown,
        by: await theAuthor(),
        shown: versionSchema.parse(1),
        content: content("x"),
      }),
    ).toEqual({ ok: false, error: "note_not_found" });
  });
});
