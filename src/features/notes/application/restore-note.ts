import * as Notes from "@/features/notes/domain/note";
import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { NoteChange } from "./note-change";
import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type RestoreNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

// The undo for deleteNote; `shown` is the version deleteNote answered with
export async function restoreNote(
  deps: RestoreNoteDeps,
  input: NoteChange,
): Promise<
  Result<
    LiveNote,
    Extract<NoteError, "note_not_found" | "note_not_deleted" | "note_changed_elsewhere">
  >
> {
  const note = await deps.notes.get(input.id);
  if (note === undefined) {
    return err("note_not_found");
  }
  if (!Audits.isCurrent(note.audit, input.shown)) {
    return err("note_changed_elsewhere");
  }

  const restored = Notes.restore(note, input.by, deps.clock());
  if (!restored.ok) {
    return restored;
  }

  const work = deps.startUnitOfWork();
  work.notes.update(restored.value);

  return (await commitUnlessStale(work)) === "stale" ? err("note_changed_elsewhere") : restored;
}
