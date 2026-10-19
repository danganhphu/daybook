import * as Notes from "@/features/notes/domain/note";
import type { LiveNote, NoteId } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { Content } from "@/shared/domain/content";
import { err, type Result } from "@/shared/domain/result";

import type { NoteError } from "./note-errors";
import type { NoteWrites } from "./note-writes";

export type EditNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly notes: NoteWrites }>;
};

export type EditNoteInput = {
  readonly id: NoteId;
  readonly content: Content;
};

export async function editNote(
  deps: EditNoteDeps,
  input: EditNoteInput,
): Promise<Result<LiveNote, Extract<NoteError, "note_not_found" | "note_deleted">>> {
  const note = await deps.notes.get(input.id);
  if (note === undefined) {
    return err("note_not_found");
  }

  const edited = Notes.edit(note, input.content, deps.clock());
  if (!edited.ok) {
    return edited;
  }

  const work = deps.startUnitOfWork();
  work.notes.update(edited.value);
  await work.commit();

  return edited;
}
