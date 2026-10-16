import type { Capture } from "../domain/capture/capture";
import type { LiveNote, Note } from "../domain/note/note";

// Collects writes and applies them together on commit: all of them, or none.
export type UnitOfWork = {
  addCapture(capture: Capture): void;
  addNote(note: LiveNote): void;
  updateNote(note: Note): void;
  commit(): Promise<void>;
};

export type StartUnitOfWork = () => UnitOfWork;
