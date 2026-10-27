import { describe, expect, it } from "vitest";

import { searchTermSchema } from "@/shared/domain/search-term";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
} from "@/testing/support/app";

import { notesSearchLimit } from "./search-notes";

function term(text: string) {
  return searchTermSchema.parse(text);
}

async function found(app: ReturnType<typeof testApp>, text: string) {
  const result = await app.searchNotes(term(text));

  return result.notes.map((note) => note.content);
}

describe("searchNotes", () => {
  it("given a note with accents, when searched with or without them, in any case, then it is found", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    await recordNote(app, "Giao 2 hộp thuốc tê cho nha khoa Minh Tâm");
    await recordNote(app, "Gọi lại cho chị Hà");

    expect(await found(app, "minh tam")).toEqual(["Giao 2 hộp thuốc tê cho nha khoa Minh Tâm"]);
    expect(await found(app, "THUỐC TÊ")).toEqual(["Giao 2 hộp thuốc tê cho nha khoa Minh Tâm"]);
  });

  it("given several words, when searched, then each must appear, in any order", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    await recordNote(app, "Giao 2 hộp thuốc tê cho nha khoa Minh Tâm");
    await recordNote(app, "Thuốc tê đã hết, hỏi lại kho");

    expect(await found(app, "tam thuoc")).toEqual(["Giao 2 hộp thuốc tê cho nha khoa Minh Tâm"]);
  });

  it("given notes on different days, when searched, then the newest comes first", async () => {
    const time = testClock("2026-10-14T01:00:00Z");
    const app = testApp(time.clock);
    await recordNote(app, "thuốc tê, lần đầu");
    time.setTo("2026-10-16T01:00:00Z");
    await recordNote(app, "thuốc tê, lần hai");

    expect(await found(app, "thuoc")).toEqual(["thuốc tê, lần hai", "thuốc tê, lần đầu"]);
  });

  it("given a deleted note, when searched, then it is left out", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await recordNote(app, "thuốc tê");
    await app.deleteNote(changeOf(note, await theAuthor()));

    expect(await found(app, "thuoc")).toEqual([]);
  });

  it("given an edited note, when searched, then its new words match and its old ones no longer do", async () => {
    const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
    const note = await recordNote(app, "thuốc tê");
    await app.editNote({ ...changeOf(note, await theAuthor()), content: content("găng tay") });

    expect(await found(app, "gang tay")).toEqual(["găng tay"]);
    expect(await found(app, "thuoc")).toEqual([]);
  });

  it.each([
    ["%", "Chiết khấu 5% cho đơn lớn"],
    ["_", "mã hàng A_12"],
  ])(
    "given %j, a wildcard in SQL, when searched, then only notes that contain it are found",
    async (typed, match) => {
      const app = testApp(testClock("2026-10-16T01:00:00Z").clock);
      await recordNote(app, match);
      await recordNote(app, "không có ký tự đó");

      expect(await found(app, typed)).toEqual([match]);
    },
  );

  it("given more notes than one search shows, when searched, then the newest are shown and the rest are said to exist", async () => {
    const time = testClock("2026-10-16T01:00:00Z");
    const app = testApp(time.clock);
    for (let index = 0; index <= notesSearchLimit; index += 1) {
      time.setTo(`2026-10-16T01:00:${String(index).padStart(2, "0")}Z`);
      // oxlint-disable-next-line no-await-in-loop -- each note needs its own later time
      await recordNote(app, `thuốc tê ${index}`);
    }

    const result = await app.searchNotes(term("thuoc"));

    expect(result.notes).toHaveLength(notesSearchLimit);
    expect(result.notes[0]?.content).toBe(`thuốc tê ${notesSearchLimit}`);
    expect(result.more).toBe(true);
  });
});
