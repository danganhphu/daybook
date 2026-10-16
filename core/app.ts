import type { Temporal } from "temporal-polyfill/implementation";

import { recordCapture, type RecordCaptureInput } from "./application/capture/record-capture";
import type { Clock } from "./application/clock";
import { deleteNote } from "./application/note/delete-note";
import { editNote, type EditNoteInput } from "./application/note/edit-note";
import { listNotesForDay } from "./application/note/list-notes-for-day";
import { restoreNote } from "./application/note/restore-note";
import type { NoteId } from "./domain/note/note";
import { createDatabase } from "./infrastructure/d1/database";
import { createNoteRepository } from "./infrastructure/d1/note-repository";
import { createUnitOfWork } from "./infrastructure/d1/unit-of-work";
import { systemClock } from "./infrastructure/system-clock";

export type App = ReturnType<typeof createApp>;

// The composition root: the one place that knows which implementation stands behind each port.
// Adapters - the web app, the Telegram bot - receive an App and never reach past it.
export function createApp(d1: D1Database, clock: Clock = systemClock) {
  const db = createDatabase(d1);
  const notes = createNoteRepository(db);
  const startUnitOfWork = () => createUnitOfWork(db);

  return {
    recordCapture: (input: RecordCaptureInput) => recordCapture({ clock, startUnitOfWork }, input),
    editNote: (input: EditNoteInput) => editNote({ clock, notes, startUnitOfWork }, input),
    deleteNote: (id: NoteId) => deleteNote({ clock, notes, startUnitOfWork }, id),
    restoreNote: (id: NoteId) => restoreNote({ notes, startUnitOfWork }, id),
    listNotesForDay: (day: Temporal.PlainDate) => listNotesForDay({ notes }, day),
  } as const;
}
