import type { Temporal } from "temporal-polyfill/implementation";

import {
  recordCapture,
  type RecordCaptureInput,
} from "@/features/capture/application/record-capture";
import { deleteNote } from "@/features/notes/application/delete-note";
import { editNote, type EditNoteInput } from "@/features/notes/application/edit-note";
import { listNotesForDay } from "@/features/notes/application/list-notes-for-day";
import { restoreNote } from "@/features/notes/application/restore-note";
import type { NoteId } from "@/features/notes/domain/note";
import { createNoteRepository } from "@/features/notes/infrastructure/note-repository";
import type { Clock } from "@/shared/application/clock";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { createUnitOfWork } from "./unit-of-work";

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
