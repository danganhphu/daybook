import * as Notes from "../../domain/note/note";
import type { LiveNote, NoteId } from "../../domain/note/note";
import type { NoteRepository } from "../../domain/note/note-repository";
import { err, type Result } from "../../domain/shared/result";
import type { DaybookError } from "../errors";
import type { StartUnitOfWork } from "../unit-of-work";

export type RestoreNoteDeps = {
  readonly notes: NoteRepository;
  readonly startUnitOfWork: StartUnitOfWork;
};

// The undo for deleteNote
export async function restoreNote(
  deps: RestoreNoteDeps,
  id: NoteId,
): Promise<Result<LiveNote, Extract<DaybookError, "note_not_found" | "note_not_deleted">>> {
  const note = await deps.notes.get(id);
  if (note === undefined) {
    return err("note_not_found");
  }

  const restored = Notes.restore(note);
  if (!restored.ok) {
    return restored;
  }

  const work = deps.startUnitOfWork();
  work.updateNote(restored.value);
  await work.commit();

  return restored;
}
