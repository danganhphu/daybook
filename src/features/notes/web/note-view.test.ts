import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as Captures from "@/features/capture/domain/capture";
import * as Notes from "@/features/notes/domain/note";
import { anAuthorId, content } from "@/testing/support/app";

import { preview, toNoteView } from "./note-view";

describe("toNoteView", () => {
  it("given a note, when viewed, then it keeps the words exactly, shows the time on the user's clock and carries its version", () => {
    const typed = "  Giao 2 hộp thuốc tê\nthu 850.000đ  ";
    const received = Temporal.Instant.from("2026-10-19T02:12:00Z");
    const note = Notes.fromCapture(Captures.receive(content(typed), "web", anAuthorId, received));

    expect(toNoteView(note)).toEqual({
      id: note.id,
      content: typed,
      createdAt: "2026-10-19T02:12:00Z",
      time: "09:12",
      version: 1,
    });
  });
});

describe("preview", () => {
  it("given a short note, when previewed, then it is the note", () => {
    expect(preview("nhớ mang catalogue")).toBe("nhớ mang catalogue");
  });

  it("given several lines, when previewed, then only the first line counts", () => {
    expect(preview("nha khoa Sao Mai hẹn gọi lại\nhỏi giá kim nha khoa")).toBe(
      "nha khoa Sao Mai hẹn gọi lại",
    );
  });

  it("given a long first line, when previewed, then it stops at 40 characters and says so", () => {
    const long = "Giao 2 hộp thuốc tê cho nha khoa Minh Tâm, thu 850.000đ trước thứ 6";

    expect(preview(long)).toBe(`${long.slice(0, 40)}...`);
  });
});
