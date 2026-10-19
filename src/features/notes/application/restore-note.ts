import * as Notes from "@/features/notes/domain/note";
import type { LiveNote, NoteId } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, type Result } from "@/shared/domain/result";

import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type RestoreNoteDeps = {
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

// The undo for deleteNote
export async function restoreNote(
  deps: RestoreNoteDeps,
  id: NoteId,
): Promise<Result<LiveNote, Extract<NoteError, "note_not_found" | "note_not_deleted">>> {
  const note = await deps.notes.get(id);
  if (note === undefined) {
    return err("note_not_found");
  }

  const restored = Notes.restore(note);
  if (!restored.ok) {
    return restored;
  }

  const work = deps.startUnitOfWork();
  work.notes.update(restored.value);
  await work.commit();

  return restored;
}
