import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { Capture, CaptureId } from "@/features/capture/domain/capture";
import type { Content } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";

// Read as a module: `import * as Notes` then `Notes.edit(note, ...)`

export const noteIdSchema = z.uuid().brand<"NoteId">();

export type NoteId = z.infer<typeof noteIdSchema>;

type NoteFields = {
  readonly id: NoteId;
  // The capture this note was filed from; it keeps her original words even after an edit
  readonly captureId: CaptureId;
  readonly content: Content;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

export type LiveNote = NoteFields & { readonly status: "live" };

export type DeletedNote = NoteFields & {
  readonly status: "deleted";
  readonly deletedAt: Temporal.Instant;
};

export type Note = LiveNote | DeletedNote;

// A note starts out as the capture it came from, with the same words and time
export function fromCapture(capture: Capture): LiveNote {
  return {
    status: "live",
    id: noteIdSchema.parse(uuidv7()),
    captureId: capture.id,
    content: capture.content,
    createdAt: capture.receivedAt,
    updatedAt: capture.receivedAt,
  };
}

export function edit(
  note: Note,
  content: Content,
  now: Temporal.Instant,
): Result<LiveNote, "note_deleted"> {
  if (note.status === "deleted") {
    return err("note_deleted");
  }

  return ok({ ...note, content, updatedAt: now });
}

// Deleting is reversible, so deleting twice is harmless and returns the note as it is
export function markDeleted(note: Note, now: Temporal.Instant): DeletedNote {
  if (note.status === "deleted") {
    return note;
  }

  return { ...note, status: "deleted", deletedAt: now };
}

export function restore(note: Note): Result<LiveNote, "note_not_deleted"> {
  if (note.status === "live") {
    return err("note_not_deleted");
  }

  return ok({
    status: "live",
    id: note.id,
    captureId: note.captureId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  });
}
