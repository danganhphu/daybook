import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as Captures from "@/features/capture/domain/capture";
import { accountIdSchema } from "@/shared/domain/account-id";
import { contentSchema } from "@/shared/domain/content";
import { anAuthorId } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import * as Notes from "./note";

const received = Temporal.Instant.from("2026-10-16T01:00:00Z");
const later = Temporal.Instant.from("2026-10-16T02:00:00Z");
const latest = Temporal.Instant.from("2026-10-16T03:00:00Z");
// The other person sharing the book
const partner = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000b2");

function aLiveNote() {
  return Notes.fromCapture(
    Captures.receive(contentSchema.parse("thuốc tê x2"), "web", anAuthorId, received),
  );
}

describe("Notes.fromCapture", () => {
  it("given a capture, when filed as a note, then the note has its words, author and time and points back at it", () => {
    const capture = Captures.receive(
      contentSchema.parse("bán 2 hộp thuốc tê"),
      "web",
      anAuthorId,
      received,
    );

    const note = Notes.fromCapture(capture);

    expect(note.status).toBe("live");
    expect(note.captureId).toBe(capture.id);
    expect(note.content).toBe(capture.content);
    expect(note.audit).toEqual({
      createdAt: received,
      createdBy: anAuthorId,
      updatedAt: received,
      updatedBy: anAuthorId,
      version: 1,
    });
  });
});

describe("Notes.edit", () => {
  it("given a live note, when the other person edits it, then the words, editor and version change, not the creation", () => {
    const edited = expectOk(
      Notes.edit(aLiveNote(), contentSchema.parse("thuốc tê x3"), partner, later),
    );

    expect(edited.content).toBe("thuốc tê x3");
    expect(edited.audit).toEqual({
      createdAt: received,
      createdBy: anAuthorId,
      updatedAt: later,
      updatedBy: partner,
      version: 2,
    });
  });

  it("given a deleted note, when edited, then it refuses with note_deleted", () => {
    const deleted = Notes.markDeleted(aLiveNote(), anAuthorId, later);

    expect(Notes.edit(deleted, contentSchema.parse("mới"), anAuthorId, latest)).toEqual({
      ok: false,
      error: "note_deleted",
    });
  });
});

describe("Notes.markDeleted", () => {
  it("given a live note, when deleted, then it records who deleted it and when, as a change", () => {
    const deleted = Notes.markDeleted(aLiveNote(), partner, later);

    expect(deleted.status).toBe("deleted");
    expect(deleted.deletion).toEqual({ deletedAt: later, deletedBy: partner });
    expect(deleted.audit.updatedBy).toBe(partner);
    expect(deleted.audit.version).toBe(2);
  });

  it("given a deleted note, when deleted again, then it is returned exactly as it was", () => {
    const deleted = Notes.markDeleted(aLiveNote(), anAuthorId, later);

    expect(Notes.markDeleted(deleted, partner, latest)).toBe(deleted);
  });
});

describe("Notes.restore", () => {
  it("given a deleted note, when restored, then it is live with its words and creation, and the restore is a change", () => {
    const original = aLiveNote();

    const restored = expectOk(
      Notes.restore(Notes.markDeleted(original, anAuthorId, later), partner, latest),
    );

    expect(restored).toEqual({
      ...original,
      audit: { ...original.audit, updatedAt: latest, updatedBy: partner, version: 3 },
    });
    expect(restored).not.toHaveProperty("deletion");
  });

  it("given a live note, when restored, then it refuses with note_not_deleted", () => {
    expect(Notes.restore(aLiveNote(), anAuthorId, later)).toEqual({
      ok: false,
      error: "note_not_deleted",
    });
  });
});
