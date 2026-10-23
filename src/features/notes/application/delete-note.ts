import * as Notes from "@/features/notes/domain/note";
import type { DeletedNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import * as Audits from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NoteChange } from "./note-change";
import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type DeleteNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

// Soft: the note can come back with restoreNote. Deleting an already deleted note changes nothing - whoever deleted
// it first, the outcome the person asked for already holds.
export async function deleteNote(
  deps: DeleteNoteDeps,
  input: NoteChange,
): Promise<Result<DeletedNote, Extract<NoteError, "note_not_found" | "note_changed_elsewhere">>> {
  const note = await deps.notes.get(input.id);
  if (note === undefined) {
    return err("note_not_found");
  }
  if (note.status === "deleted") {
    return ok(note);
  }
  if (!Audits.isCurrent(note.audit, input.shown)) {
    return err("note_changed_elsewhere");
  }

  const deleted = Notes.markDeleted(note, input.by, deps.clock());

  const work = deps.startUnitOfWork();
  work.notes.update(deleted);

  return (await commitUnlessStale(work)) === "stale" ? err("note_changed_elsewhere") : ok(deleted);
}
