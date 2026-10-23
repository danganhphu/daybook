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

describe("deleteNote", () => {
  it("given a live note, when the other person deletes it, then it records who and when", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await recordNote(app, "xoá");
    const partner = await thePartner();
    time.setTo("2026-10-16T01:05:00Z");

    const deleted = expectOk(await app.deleteNote(changeOf(note, partner)));

    expect(deleted.status).toBe("deleted");
    expect(deleted.deletion.deletedAt.toString()).toBe("2026-10-16T01:05:00Z");
    expect(deleted.deletion.deletedBy).toBe(partner);
    expect(deleted.audit.version).toBe(2);
    expect(await app.listNotesForDay(app.today())).toEqual([]);
  });

  it("given a deleted note, when deleted again from a screen that still shows it, then nothing changes, not even who deleted it", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    const note = await recordNote(app, "xoá");
    time.setTo("2026-10-16T01:05:00Z");
    const first = expectOk(await app.deleteNote(changeOf(note, await theAuthor())));
    time.setTo("2026-10-16T01:06:00Z");

    const again = expectOk(await app.deleteNote(changeOf(note, await thePartner())));

    expect(again).toEqual(first);
  });

  it("given a note edited on another device since it was shown, when deleted, then it is refused and the note stays", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const shown = await recordNote(app, "thuốc tê x2");
    await app.editNote({ ...changeOf(shown, await thePartner()), content: content("thuốc tê x5") });

    expect(await app.deleteNote(changeOf(shown, await theAuthor()))).toEqual({
      ok: false,
      error: "note_changed_elsewhere",
    });
    expect(await app.listNotesForDay(app.today())).toHaveLength(1);
  });

  it("given an id that matches no note, when deleted, then it refuses with note_not_found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const unknown = noteIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(
      await app.deleteNote({ id: unknown, by: await theAuthor(), shown: versionSchema.parse(1) }),
    ).toEqual({ ok: false, error: "note_not_found" });
  });
});
