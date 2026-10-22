import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as Captures from "@/features/capture/domain/capture";
import * as Notes from "@/features/notes/domain/note";
import { anAuthorId, content } from "@/testing/support/app";

import { clockTime, preview, toNoteView } from "./note-view";

describe("toNoteView", () => {
  it("given a note, when viewed, then it keeps the words exactly and shows the time on the user's clock", () => {
    const typed = "  Giao 2 thùng giấy in\nthu 850.000đ  ";
    const received = Temporal.Instant.from("2026-10-19T02:12:00Z");
    const note = Notes.fromCapture(Captures.receive(content(typed), "web", anAuthorId, received));

    expect(toNoteView(note)).toEqual({
      id: note.id,
      content: typed,
      createdAt: "2026-10-19T02:12:00Z",
      time: "09:12",
    });
  });
});

describe("preview", () => {
  it("given a short note, when previewed, then it is the note", () => {
    expect(preview("nhớ mang catalogue")).toBe("nhớ mang catalogue");
  });

  it("given several lines, when previewed, then only the first line counts", () => {
    expect(preview("cửa hàng Sao Mai hẹn gọi lại\nhỏi giá bìa hồ sơ")).toBe(
      "cửa hàng Sao Mai hẹn gọi lại",
    );
  });

  it("given a long first line, when previewed, then it stops at 40 characters and says so", () => {
    const long = "Giao 2 thùng giấy in cho cửa hàng Minh Tâm, thu 850.000đ trước thứ 6";

    expect(preview(long)).toBe(`${long.slice(0, 40)}...`);
  });
});

describe("clockTime", () => {
  it("given the last minute of a Vietnamese day, when shown, then it reads 23:59", () => {
    const instant = Temporal.Instant.from("2026-10-19T16:59:59Z");

    expect(clockTime(instant.epochMilliseconds)).toBe("23:59");
  });

  it("given midnight in Vietnam, when shown, then it reads 00:00, not 24:00", () => {
    const instant = Temporal.Instant.from("2026-10-19T17:00:00Z");

    expect(clockTime(instant.epochMilliseconds)).toBe("00:00");
  });
});
