import type { LiveNote, Note } from "@/features/notes/domain/note";

// Queues note changes on the current unit of work; nothing is stored until it commits
export type NoteWrites = {
  add(note: LiveNote): void;
  update(note: Note): void;
};
