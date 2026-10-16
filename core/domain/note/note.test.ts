import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../tests/support/result";
import * as Captures from "../capture/capture";
import { contentSchema } from "../shared/content";
import * as Notes from "./note";

const received = Temporal.Instant.from("2026-10-16T01:00:00Z");
const later = Temporal.Instant.from("2026-10-16T02:00:00Z");
const latest = Temporal.Instant.from("2026-10-16T03:00:00Z");

function aLiveNote() {
  return Notes.fromCapture(Captures.receive(contentSchema.parse("gel tê x2"), "web", received));
}

describe("Notes.fromCapture", () => {
  it("given a capture, when filed as a note, then the note has its words and time and points back at it", () => {
    const capture = Captures.receive(contentSchema.parse("bán 2 hộp gel tê"), "web", received);

    const note = Notes.fromCapture(capture);

    expect(note.status).toBe("live");
    expect(note.captureId).toBe(capture.id);
    expect(note.content).toBe(capture.content);
    expect(note.createdAt).toBe(received);
    expect(note.updatedAt).toBe(received);
  });
});

describe("Notes.edit", () => {
  it("given a live note, when edited, then the content is replaced and only updatedAt moves", () => {
    const edited = expectOk(Notes.edit(aLiveNote(), contentSchema.parse("gel tê x3"), later));

    expect(edited.content).toBe("gel tê x3");
    expect(edited.createdAt).toBe(received);
    expect(edited.updatedAt).toBe(later);
  });

  it("given a deleted note, when edited, then it refuses with note_deleted", () => {
    const deleted = Notes.markDeleted(aLiveNote(), later);

    expect(Notes.edit(deleted, contentSchema.parse("mới"), latest)).toEqual({
      ok: false,
      error: "note_deleted",
    });
  });
});

describe("Notes.markDeleted", () => {
  it("given a live note, when deleted, then it is marked deleted at that time", () => {
    const deleted = Notes.markDeleted(aLiveNote(), later);

    expect(deleted.status).toBe("deleted");
    expect(deleted.deletedAt).toBe(later);
  });

  it("given a deleted note, when deleted again, then it is returned exactly as it was", () => {
    const deleted = Notes.markDeleted(aLiveNote(), later);

    expect(Notes.markDeleted(deleted, latest)).toBe(deleted);
  });
});

describe("Notes.restore", () => {
  it("given a deleted note, when restored, then it is the live note it was before", () => {
    const original = aLiveNote();

    const restored = expectOk(Notes.restore(Notes.markDeleted(original, later)));

    expect(restored).toEqual(original);
  });

  it("given a live note, when restored, then it refuses with note_not_deleted", () => {
    expect(Notes.restore(aLiveNote())).toEqual({ ok: false, error: "note_not_deleted" });
  });
});
