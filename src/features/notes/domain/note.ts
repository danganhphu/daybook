import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { Capture, CaptureId } from "@/features/capture/domain/capture";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Deletion } from "@/shared/domain/audit";
import type { Content } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";

// Read as a module: `import * as Notes` then `Notes.edit(note, ...)`

export const noteIdSchema = z.uuid().brand<"NoteId">();

export type NoteId = z.infer<typeof noteIdSchema>;

type NoteFields = {
  readonly id: NoteId;
  // The capture this note was filed from; it keeps the original words even after an edit
  readonly captureId: CaptureId;
  readonly content: Content;
  // Created by whoever typed the capture, when it arrived; so a note stays on the day it was sent
  readonly audit: Audit;
};

export type LiveNote = NoteFields & { readonly status: "live" };

export type DeletedNote = NoteFields & {
  readonly status: "deleted";
  readonly deletion: Deletion;
};

export type Note = LiveNote | DeletedNote;

// A note starts out as the capture it came from, with the same words, author and time
export function fromCapture(capture: Capture): LiveNote {
  return {
    status: "live",
    id: noteIdSchema.parse(uuidv7()),
    captureId: capture.id,
    content: capture.content,
    audit: Audits.start(capture.authorId, capture.receivedAt),
  };
}

export function edit(
  note: Note,
  content: Content,
  by: AccountId,
  now: Temporal.Instant,
): Result<LiveNote, "note_deleted"> {
  if (note.status === "deleted") {
    return err("note_deleted");
  }

  return ok({ ...note, content, audit: Audits.change(note.audit, by, now) });
}

// Deleting is reversible, so deleting twice is harmless and returns the note as it is
export function markDeleted(note: Note, by: AccountId, now: Temporal.Instant): DeletedNote {
  if (note.status === "deleted") {
    return note;
  }

  return {
    ...note,
    status: "deleted",
    audit: Audits.change(note.audit, by, now),
    deletion: Audits.deletion(by, now),
  };
}

export function restore(
  note: Note,
  by: AccountId,
  now: Temporal.Instant,
): Result<LiveNote, "note_not_deleted"> {
  if (note.status === "live") {
    return err("note_not_deleted");
  }

  return ok({
    status: "live",
    id: note.id,
    captureId: note.captureId,
    content: note.content,
    audit: Audits.change(note.audit, by, now),
  });
}
