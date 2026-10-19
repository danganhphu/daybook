import * as Notes from "@/features/notes/domain/note";
import type { DeletedNote, NoteId } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type DeleteNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

// Soft: the note can come back with restoreNote. Deleting an already deleted note changes nothing.
export async function deleteNote(
  deps: DeleteNoteDeps,
  id: NoteId,
): Promise<Result<DeletedNote, Extract<NoteError, "note_not_found">>> {
  const note = await deps.notes.get(id);
  if (note === undefined) {
    return err("note_not_found");
  }

  if (note.status === "deleted") {
    return ok(note);
  }

  const deleted = Notes.markDeleted(note, deps.clock());

  const work = deps.startUnitOfWork();
  work.notes.update(deleted);
  await work.commit();

  return ok(deleted);
}
