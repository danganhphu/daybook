import * as Notes from "@/features/notes/domain/note";
import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import * as Audits from "@/shared/domain/audit";
import type { Content } from "@/shared/domain/content";
import { err, type Result } from "@/shared/domain/result";

import type { NoteChange } from "./note-change";
import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type EditNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

export type EditNoteInput = NoteChange & { readonly content: Content };

export async function editNote(
  deps: EditNoteDeps,
  input: EditNoteInput,
): Promise<
  Result<LiveNote, Extract<NoteError, "note_not_found" | "note_deleted" | "note_changed_elsewhere">>
> {
  const note = await deps.notes.get(input.id);
  if (note === undefined) {
    return err("note_not_found");
  }
  if (!Audits.isCurrent(note.audit, input.shown)) {
    return err("note_changed_elsewhere");
  }

  const edited = Notes.edit(note, input.content, input.by, deps.clock());
  if (!edited.ok) {
    return edited;
  }

  const work = deps.startUnitOfWork();
  work.notes.update(edited.value);

  // Someone saved between the read above and this write
  return (await commitUnlessStale(work)) === "stale" ? err("note_changed_elsewhere") : edited;
}
