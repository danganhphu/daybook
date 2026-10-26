import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import { noteErrorMessages } from "@/features/notes/application/note-errors";
import { recordNote, testApp, testClock, theAuthor, thePartner } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import {
  dayNotes,
  deletedNotes,
  deleteNote,
  editNote,
  restoreNote,
  searchNotes,
  todaysNotes,
} from "./commands";
import { toNoteView } from "./note-view";

async function recorded(app: App, text: string) {
  return toNoteView(await recordNote(app, text));
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

  it("given a moment just after midnight in Vietnam, when shown, then it is the new day, before UTC gets there", async () => {
    const app = testApp(testClock("2026-10-18T17:30:00Z").clock); // 00:30 on Monday the 19th

    const today = await todaysNotes(app);

    expect(today.day).toBe("2026-10-19");
    expect(today.title).toBe("Hôm nay");
    expect(today.subtitle).toBe("Thứ Hai, 19/10");
    expect(today.isToday).toBe(true);
  });

  it("given the last minute of a Vietnamese day, when shown, then it is still that day", async () => {
    const app = testApp(testClock("2026-10-19T16:59:00Z").clock); // 23:59 on the 19th

    expect((await todaysNotes(app)).day).toBe("2026-10-19");
  });

  it("given today, when shown, then it links back to yesterday and to no later day", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);

    const today = await todaysNotes(app);

    expect(today.previous).toEqual({ path: "/days/2026-10-18", label: "Chủ Nhật, 18/10" });
    expect(today.next).toBeUndefined();
  });
});

describe("dayNotes", () => {
  it("given yesterday, when shown, then it links to the day before and to today at the home screen", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);

    const yesterday = await dayNotes(app, Temporal.PlainDate.from("2026-10-18"));

    expect(yesterday.title).toBe("Hôm qua");
    expect(yesterday.isToday).toBe(false);
    expect(yesterday.previous.path).toBe("/days/2026-10-17");
    expect(yesterday.next).toEqual({ path: "/", label: "Thứ Hai, 19/10" });
    expect(yesterday.today).toBe("2026-10-19");
  });

  it("given an earlier day with notes, when shown, then only that day's notes are there, oldest first", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    await recorded(app, "thứ sáu, sáng");
    time.setTo("2026-10-16T09:00:00Z");
    await recorded(app, "thứ sáu, chiều");
    time.setTo("2026-10-19T01:00:00Z");
    await recorded(app, "thứ hai");

    const friday = await dayNotes(app, Temporal.PlainDate.from("2026-10-16"));

    expect(friday.title).toBe("Thứ Sáu, 16/10");
    expect(friday.subtitle).toBe("3 ngày trước");
    expect(friday.notes.map((note) => note.content)).toEqual(["thứ sáu, sáng", "thứ sáu, chiều"]);
  });
});

describe("searchNotes", () => {
  it("given nothing typed, when searched, then nothing is searched", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    await recorded(app, "thuốc tê");

    for (const query of [undefined, "", "   ", ["thuốc", "tê"]]) {
      // oxlint-disable-next-line no-await-in-loop -- one query at a time keeps the failure message readable
      expect(await searchNotes(app, query)).toEqual({
        query: typeof query === "string" ? query : "",
        searched: false,
        days: [],
        more: false,
      });
    }
  });

  it("given matches on several days, when searched, then they are grouped by day, newest first, each day linking to itself", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    await recorded(app, "thuốc tê, thứ sáu");
    time.setTo("2026-10-19T01:00:00Z");
    await recorded(app, "thuốc tê, sáng nay");
    time.setTo("2026-10-19T05:00:00Z");
    await recorded(app, "thuốc tê, trưa nay");
    await recorded(app, "găng tay");

    const view = await searchNotes(app, "Thuốc");

    expect(view.query).toBe("Thuốc");
    expect(view.searched).toBe(true);
    expect(view.more).toBe(false);
    expect(
      view.days.map((day) => ({
        label: day.label,
        path: day.path,
        notes: day.notes.map((note) => note.content),
      })),
    ).toEqual([
      { label: "Hôm nay", path: "/", notes: ["thuốc tê, trưa nay", "thuốc tê, sáng nay"] },
      { label: "Thứ Sáu, 16/10", path: "/days/2026-10-16", notes: ["thuốc tê, thứ sáu"] },
    ]);
  });

  it("given a note written just after midnight in Vietnam, when found, then it is under the Vietnamese day", async () => {
    const app = testApp(testClock("2026-10-18T17:30:00Z").clock); // 00:30 on the 19th
    await recorded(app, "thuốc tê");

    const [day] = (await searchNotes(app, "thuoc")).days;

    expect(day?.day).toBe("2026-10-19");
  });
});

describe("editNote", () => {
  it("given a note, when edited at the version shown, then it carries the new words and the next version", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "thuốc tê x2");

    const edited = expectOk(
      await editNote(app, await theAuthor(), note.id, note.version, "thuốc tê x3"),
    );

    expect(edited.content).toBe("thuốc tê x3");
    expect(edited.version).toBe(note.version + 1);
  });

  it("given a note the other person changed after it was shown, when edited, then it says so in the user's words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "thuốc tê x2");
    expectOk(await editNote(app, await thePartner(), note.id, note.version, "thuốc tê x5"));

    expect(await editNote(app, await theAuthor(), note.id, note.version, "thuốc tê x3")).toEqual({
      ok: false,
      error: noteErrorMessages.note_changed_elsewhere,
    });
  });

  it.each([
    { id: "not-an-id", version: 1 },
    { id: undefined, version: 1 },
    { id: "019a0000-0000-7000-8000-000000000099", version: 0 },
    { id: "019a0000-0000-7000-8000-000000000099", version: "1" },
  ])(
    "given an id or version that cannot name a note as shown ($id, $version), when edited, then it says the note is gone",
    async ({ id, version }) => {
      const app = testApp(testClock("2026-10-19T01:00:00Z").clock);

      expect(await editNote(app, await theAuthor(), id, version, "x")).toEqual({
        ok: false,
        error: noteErrorMessages.note_not_found,
      });
    },
  );

  it.each([0, -1, 1.5, "1", undefined])(
    "given a real note and a version no screen shows (%s), when edited, then it is refused and the note keeps its words",
    async (version) => {
      const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
      const note = await recorded(app, "giữ nguyên");

      expect(await editNote(app, await theAuthor(), note.id, version, "đổi")).toEqual({
        ok: false,
        error: noteErrorMessages.note_not_found,
      });
      expect(await notesToday(app)).toEqual([note]);
    },
  );

  it("given a deleted note, when edited at the version the deletion left, then it says so in the user's words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const author = await theAuthor();
    const note = await recorded(app, "cũ");
    const deleted = expectOk(await deleteNote(app, author, note.id, note.version));

    expect(await editNote(app, author, note.id, deleted.version, "mới")).toEqual({
      ok: false,
      error: noteErrorMessages.note_deleted,
    });
  });

  it("given blank words, when edited, then it is refused and the note keeps its words", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "giữ nguyên");

    expect(await editNote(app, await theAuthor(), note.id, note.version, " ")).toEqual({
      ok: false,
      error: "Chưa có nội dung",
    });
    expect((await notesToday(app)).map((listed) => listed.content)).toEqual(["giữ nguyên"]);
  });
});

describe("deleteNote and restoreNote", () => {
  it("given a note, when deleted, then it leaves the day; when restored with the version the deletion answered, then it is back", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const author = await theAuthor();
    const note = await recorded(app, "lỡ tay");

    const deleted = expectOk(await deleteNote(app, author, note.id, note.version));
    expect(await notesToday(app)).toEqual([]);

    const restored = expectOk(await restoreNote(app, author, deleted.id, deleted.version));
    expect(await notesToday(app)).toEqual([restored]);
    expect(restored).toEqual({ ...note, version: note.version + 2 });
  });

  it("given a note that is not deleted, when restored, then it says there is nothing to restore", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const note = await recorded(app, "còn đây");

    expect(await restoreNote(app, await theAuthor(), note.id, note.version)).toEqual({
      ok: false,
      error: noteErrorMessages.note_not_deleted,
    });
  });

  it("given a malformed id, when deleted or restored, then it says the note is gone", async () => {
    const app = testApp(testClock("2026-10-19T01:00:00Z").clock);
    const author = await theAuthor();
    const gone = { ok: false, error: noteErrorMessages.note_not_found };

    expect(await deleteNote(app, author, "x", 1)).toEqual(gone);
    expect(await restoreNote(app, author, "x", 1)).toEqual(gone);
  });
});

describe("deletedNotes", () => {
  it("given notes deleted now and a month ago, when the recently deleted list is read, then only the recent one is there, latest first, and restoring it brings it back", async () => {
    const time = testClock("2026-09-20T03:00:00Z");
    const app = testApp(time.clock);
    const author = await theAuthor();
    const old = await recorded(app, "xoá lâu rồi");
    expectOk(await deleteNote(app, author, old.id, old.version));
    time.setTo("2026-10-23T03:00:00Z");
    const first = await recorded(app, "xoá trước");
    const second = await recorded(app, "xoá sau");
    expectOk(await deleteNote(app, author, first.id, first.version));
    time.setTo("2026-10-23T04:00:00Z");
    expectOk(await deleteNote(app, author, second.id, second.version));

    const rows = await deletedNotes(app, await app.displayNames());

    expect(rows.map((row) => [row.title, row.detail])).toEqual([
      ["xoá sau", "Xoá 23/10 (Người ghi)"],
      ["xoá trước", "Xoá 23/10 (Người ghi)"],
    ]);
    expectOk(await restoreNote(app, author, first.id, rows[1]?.version));
    expect(await deletedNotes(app, await app.displayNames())).toHaveLength(1);
  });
});
