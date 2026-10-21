import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import { noteErrorMessages } from "@/features/notes/application/note-errors";
import { content, testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { deleteNote, editNote, restoreNote, todaysNotes } from "./commands";
import { toNoteView } from "./note-view";

async function recorded(app: App, text: string) {
  return toNoteView(await app.recordCapture({ content: content(text), source: "web" }));
}

async function notesToday(app: App) {
  return (await todaysNotes(app)).notes;
}

describe("todaysNotes", () => {
  it("given notes through the day, when listed, then the oldest comes first, as in a chat", async () => {
    const time = testClock("2026-10-19T01:00:00Z");
    const app = testApp(time.clock);
    await recorded(app, "sáng");
    time.setTo("2026-10-19T05:00:00Z");
    await recorded(app, "trưa");

    const listed = await notesToday(app);

    expect(listed.map((note) => note.content)).toEqual(["sáng", "trưa"]);
  });

  it("given a moment just after midnight in Vietnam, when labelled, then it names the new day", async () => {
    const app = testApp(testClock("2026-10-18T17:30:00Z").clock); // 00:30 on Monday the 19th

    expect((await todaysNotes(app)).label).toBe("Thứ Hai, 19/10");
  });
});

describe("editNote", () => {
  it("given a note, when edited, then it carries the new words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "giấy in x2");

    const edited = expectOk(await editNote(app, note.id, "giấy in x3"));

    expect(edited.content).toBe("giấy in x3");
  });

  it("given an id that is not a note id, when edited, then it says the note is gone", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);

    expect(await editNote(app, "not-an-id", "x")).toEqual({
      ok: false,
      error: noteErrorMessages.note_not_found,
    });
  });

  it("given a deleted note, when edited, then it says so in the user's words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "cũ");
    await deleteNote(app, note.id);

    expect(await editNote(app, note.id, "mới")).toEqual({
      ok: false,
      error: noteErrorMessages.note_deleted,
    });
  });

  it("given blank words, when edited, then it is refused and the note keeps its words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "giữ nguyên");

    expect(await editNote(app, note.id, " ")).toEqual({ ok: false, error: "Chưa có nội dung" });
    expect((await notesToday(app)).map((listed) => listed.content)).toEqual(["giữ nguyên"]);
  });
});

describe("deleteNote and restoreNote", () => {
  it("given a note, when deleted, then it leaves the day; when restored, then it is back", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "lỡ tay");

    expectOk(await deleteNote(app, note.id));
    expect(await notesToday(app)).toEqual([]);

    expectOk(await restoreNote(app, note.id));
    expect(await notesToday(app)).toEqual([note]);
  });

  it("given a note that is not deleted, when restored, then it says there is nothing to restore", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "còn đây");

    expect(await restoreNote(app, note.id)).toEqual({
      ok: false,
      error: noteErrorMessages.note_not_deleted,
    });
  });
});
