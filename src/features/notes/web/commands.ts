import { Temporal } from "temporal-polyfill/implementation";

import type { App } from "@/composition/create-app";
import type { NoteChange } from "@/features/notes/application/note-change";
import { noteErrorMessages, type NoteError } from "@/features/notes/application/note-errors";
import { noteIdSchema, type LiveNote, type Note } from "@/features/notes/domain/note";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { parseContent } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchTermSchema } from "@/shared/domain/search-text";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { dayHeading, dayLabel } from "@/shared/web/day-label";
import { recentlyDeleted, type DeletedRowView } from "@/shared/web/recently-deleted";
import { deletedText, recentlyDeletedSince } from "@/shared/web/recently-deleted-since";
import { dayPath } from "@/shared/web/routes";

import { preview, toNoteView, type NoteResult, type NoteView } from "./note-view";

// What the web adapter does for each request, minus the framework: parse what the browser sent, call the app, and
// answer with a view or the sentence the user should read. Server actions wrap these; tests call them directly.

export async function editNote(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  text: unknown,
): Promise<NoteResult> {
  const change = parseChange(by, id, version);
  if (change === undefined) {
    return err(noteErrorMessages.note_not_found);
  }

  const content = parseContent(text);
  if (!content.ok) {
    return content;
  }

  return toView(await app.editNote({ ...change, content: content.value }));
}

export async function deleteNote(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<NoteResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(noteErrorMessages.note_not_found)
    : toView(await app.deleteNote(change));
}

export async function restoreNote(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<NoteResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(noteErrorMessages.note_not_found)
    : toView(await app.restoreNote(change));
}

// A day the screen links to: where it is, and its date for the link's accessible name
export type DayLink = { readonly path: string; readonly label: string };

// One day of notes, as its screen shows it. Days are YYYY-MM-DD.
export type DayView = {
  readonly day: string;
  // Large: "Hôm nay", "Hôm qua" or the date; small: the date, or how long ago
  readonly title: string;
  readonly subtitle: string;
  readonly isToday: boolean;
  readonly previous: DayLink;
  // None after today: no notes can be there yet
  readonly next: DayLink | undefined;
  // For the date picker: no day after this one
  readonly today: string;
  // Oldest first: the screen is a chat, newest at the bottom next to the box
  readonly notes: ReadonlyArray<NoteView>;
};

export async function dayNotes(app: App, day: Temporal.PlainDate): Promise<DayView> {
  const today = app.today();
  const notes = await app.listNotesForDay(day);
  const link = (other: Temporal.PlainDate): DayLink => ({
    path: dayPath(other.toString(), today.toString()),
    label: dayLabel(other, today),
  });
  const next = day.add({ days: 1 });

  return {
    day: day.toString(),
    ...dayHeading(day, today),
    isToday: day.equals(today),
    previous: link(day.subtract({ days: 1 })),
    next: Temporal.PlainDate.compare(next, today) > 0 ? undefined : link(next),
    today: today.toString(),
    notes: notes.map(toNoteView).toReversed(),
  };
}

export function todaysNotes(app: App): Promise<DayView> {
  return dayNotes(app, app.today());
}

// The notes a search found, grouped by the day they were written, newest first
export type SearchView = {
  // As typed, to fill the box again
  readonly query: string;
  readonly searched: boolean;
  readonly days: ReadonlyArray<{
    readonly day: string;
    // "Hôm nay", "Hôm qua" or the date
    readonly label: string;
    readonly path: string;
    readonly notes: ReadonlyArray<NoteView>;
  }>;
  // More matched than are shown
  readonly more: boolean;
};

// Notes deleted lately, for "Đã xoá gần đây"; `people` names who deleted each
export async function deletedNotes(
  app: App,
  people: ReadonlyMap<AccountId, string>,
): Promise<ReadonlyArray<DeletedRowView>> {
  const notes = await app.listDeletedNotes(recentlyDeletedSince(app.now()), recentlyDeleted.limit);

  return notes.map((note) => ({
    id: note.id,
    version: note.audit.version,
    title: preview(note.content),
    detail: deletedText(note.deletion.deletedAt, people.get(note.deletion.deletedBy) ?? "?"),
  }));
}

export async function searchNotes(app: App, query: unknown): Promise<SearchView> {
  const typed = typeof query === "string" ? query : "";
  const term = searchTermSchema.safeParse(typed);
  if (!term.success) {
    return { query: typed, searched: false, days: [], more: false };
  }

  const today = app.today();
  const found = await app.searchNotes(term.data);
  // Map keeps the order days were first met in, and the notes come newest first
  const byDay = Map.groupBy(found.notes, (note: LiveNote) =>
    vietnamDate(note.audit.createdAt).toString(),
  );

  return {
    query: typed,
    searched: true,
    more: found.more,
    days: [...byDay].map(([day, notes]) => ({
      day,
      label: dayHeading(Temporal.PlainDate.from(day), today).title,
      path: dayPath(day, today.toString()),
      notes: notes.map(toNoteView),
    })),
  };
}

// A malformed id or version cannot name a note as it was shown, so to the user it is simply gone
function parseChange(by: AccountId, id: unknown, version: unknown): NoteChange | undefined {
  const noteId = noteIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return noteId.success && shown.success ? { id: noteId.data, by, shown: shown.data } : undefined;
}

function toView(result: Result<Note, NoteError>): NoteResult {
  return result.ok ? ok(toNoteView(result.value)) : err(noteErrorMessages[result.error]);
}
