import type { Temporal } from "temporal-polyfill/implementation";

import type { App } from "@/composition/create-app";
import { noteErrorMessages, type NoteError } from "@/features/notes/application/note-errors";
import { noteIdSchema, type Note, type NoteId } from "@/features/notes/domain/note";
import { parseContent } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";

import { toNoteView, type NoteResult, type NoteView } from "./note-view";

// What the web adapter does for each request, minus the framework: parse what the browser sent, call the app, and
// answer with a view or the sentence the user should read. Server actions wrap these; tests call them directly.

export async function editNote(app: App, id: unknown, text: unknown): Promise<NoteResult> {
  const noteId = parseNoteId(id);
  if (noteId === undefined) {
    return err(noteErrorMessages.note_not_found);
  }

  const content = parseContent(text);
  if (!content.ok) {
    return content;
  }

  return toView(await app.editNote({ id: noteId, content: content.value }));
}

export async function deleteNote(app: App, id: unknown): Promise<NoteResult> {
  const noteId = parseNoteId(id);
  if (noteId === undefined) {
    return err(noteErrorMessages.note_not_found);
  }

  return toView(await app.deleteNote(noteId));
}

export async function restoreNote(app: App, id: unknown): Promise<NoteResult> {
  const noteId = parseNoteId(id);
  if (noteId === undefined) {
    return err(noteErrorMessages.note_not_found);
  }

  return toView(await app.restoreNote(noteId));
}

export type TodayView = {
  // "Thứ Hai, 19/10"
  readonly label: string;
  // Oldest first: the screen is a chat, newest at the bottom next to the box
  readonly notes: ReadonlyArray<NoteView>;
};

export async function todaysNotes(app: App): Promise<TodayView> {
  const today = await app.listNotesForToday();

  return { label: dayLabel(today.day), notes: today.notes.map(toNoteView).toReversed() };
}

const dayFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
});

// The date is already the user's; formatting its UTC midnight in UTC keeps the same calendar day
function dayLabel(day: Temporal.PlainDate): string {
  return dayFormat.format(Date.UTC(day.year, day.month - 1, day.day));
}

// A malformed id cannot name a note, so to the user it is simply gone
function parseNoteId(id: unknown): NoteId | undefined {
  const parsed = noteIdSchema.safeParse(id);

  return parsed.success ? parsed.data : undefined;
}

function toView(result: Result<Note, NoteError>): NoteResult {
  return result.ok ? ok(toNoteView(result.value)) : err(noteErrorMessages[result.error]);
}
