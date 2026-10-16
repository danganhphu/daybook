import * as Notes from "../../domain/note/note";
import type { LiveNote, NoteId } from "../../domain/note/note";
import type { NoteRepository } from "../../domain/note/note-repository";
import type { Content } from "../../domain/shared/content";
import { err, type Result } from "../../domain/shared/result";
import type { Clock } from "../clock";
import type { DaybookError } from "../errors";
import type { StartUnitOfWork } from "../unit-of-work";

export type EditNoteDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: StartUnitOfWork;
};

export type EditNoteInput = {
  readonly id: NoteId;
  readonly content: Content;
};

export async function editNote(
  deps: EditNoteDeps,
  input: EditNoteInput,
): Promise<Result<LiveNote, Extract<DaybookError, "note_not_found" | "note_deleted">>> {
  const note = await deps.notes.get(input.id);
  if (note === undefined) {
    return err("note_not_found");
  }

  const edited = Notes.edit(note, input.content, deps.clock());
  if (!edited.ok) {
    return edited;
  }

  const work = deps.startUnitOfWork();
  work.updateNote(edited.value);
  await work.commit();

  return edited;
}
