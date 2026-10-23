import { describe, expect, it } from "vitest";

import { applyChange, type ShownNote } from "./note-list";

function shown(id: string, createdAt: string, text = id): ShownNote {
  return { id, content: text, createdAt, time: "", version: 1, saving: false };
}

const morning = shown("a", "2026-10-19T01:00:00Z");
const noon = shown("b", "2026-10-19T05:00:00Z");
const evening = shown("c", "2026-10-19T11:00:00Z");

describe("applyChange", () => {
  it("given a list, when a note is added, then it goes last, marked as saving", () => {
    const added = applyChange([morning, noon], { kind: "add", note: evening });

    expect(added).toEqual([morning, noon, { ...evening, saving: true }]);
  });

  it("given a list, when a note is edited, then only its words change and it is marked as saving", () => {
    const edited = applyChange([morning, noon], { kind: "edit", id: "a", content: "mới" });

    expect(edited).toEqual([{ ...morning, content: "mới", saving: true }, noon]);
  });

  it("given a list, when a note is removed, then it is gone and the rest keep their order", () => {
    expect(applyChange([morning, noon, evening], { kind: "remove", id: "b" })).toEqual([
      morning,
      evening,
    ]);
  });

  it("given a removed note, when it is restored, then it returns to its place by time, marked as saving", () => {
    const restored = applyChange([morning, evening], { kind: "restore", note: noon });

    expect(restored).toEqual([morning, { ...noon, saving: true }, evening]);
  });

  it("given an id that is not in the list, when edited or removed, then the list is unchanged", () => {
    const notes = [morning, noon];

    expect(applyChange(notes, { kind: "edit", id: "x", content: "?" })).toEqual(notes);
    expect(applyChange(notes, { kind: "remove", id: "x" })).toEqual(notes);
  });
});
