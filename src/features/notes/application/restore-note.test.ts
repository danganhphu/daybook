import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { versionSchema } from "@/shared/domain/audit";
import {
  changeOf,
  recordNote,
  testApp,
  testClock,
  theAuthor,
  thePartner,
} from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

describe("restoreNote", () => {
  it("given a deleted note, when restored, then it is back with its words and in its original place", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const author = await theAuthor();
    await recordNote(app, "một");
    time.setTo("2026-10-16T02:00:00Z");
    const second = await recordNote(app, "hai");
    time.setTo("2026-10-16T03:00:00Z");
    await recordNote(app, "ba");
    const deleted = expectOk(await app.deleteNote(changeOf(second, author)));

    const restored = expectOk(await app.restoreNote(changeOf(deleted, author)));
    const listed = await app.listNotesForDay(app.today());

    expect(restored.content).toBe("hai");
    expect(restored.audit.createdAt).toEqual(second.audit.createdAt);
    expect(restored.audit.version).toBe(3);
    expect(listed.map((note) => note.content)).toEqual(["ba", "hai", "một"]);
  });

  it("given a note restored and edited on another device, when the undo comes late, then it is refused", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const author = await theAuthor();
    const partner = await thePartner();
    const note = await recordNote(app, "lỡ tay");
    const deleted = expectOk(await app.deleteNote(changeOf(note, author)));
    expectOk(await app.restoreNote(changeOf(deleted, partner)));

    expect(await app.restoreNote(changeOf(deleted, author))).toEqual({
      ok: false,
      error: "note_changed_elsewhere",
    });
  });

  it("given a live note, when restored at its version, then it refuses with note_not_deleted", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await recordNote(app, "còn");

    expect(await app.restoreNote(changeOf(note, await theAuthor()))).toEqual({
      ok: false,
      error: "note_not_deleted",
    });
  });

  it("given an id that matches no note, when restored, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(
      await app.restoreNote({ id: unknown, by: await theAuthor(), shown: versionSchema.parse(1) }),
    ).toEqual({ ok: false, error: "note_not_found" });
  });
});
