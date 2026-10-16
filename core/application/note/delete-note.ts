import * as Notes from "../../domain/note/note";
import type { DeletedNote, NoteId } from "../../domain/note/note";
import type { NoteRepository } from "../../domain/note/note-repository";
import { err, ok, type Result } from "../../domain/shared/result";
import type { Clock } from "../clock";
import type { DaybookError } from "../errors";
import type { StartUnitOfWork } from "../unit-of-work";

export type DeleteNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: StartUnitOfWork;
};

// Soft: the note can come back with restoreNote. Deleting an already deleted note changes nothing.
export async function deleteNote(
  deps: DeleteNoteDeps,
  id: NoteId,
): Promise<Result<DeletedNote, Extract<DaybookError, "note_not_found">>> {
  const note = await deps.notes.get(id);
  if (note === undefined) {
    return err("note_not_found");
  }

  if (note.status === "deleted") {
    return ok(note);
  }

  const deleted = Notes.markDeleted(note, deps.clock());

  const work = deps.startUnitOfWork();
  work.updateNote(deleted);
  await work.commit();

  return ok(deleted);
}
