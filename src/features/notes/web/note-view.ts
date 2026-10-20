import type { Note } from "@/features/notes/domain/note";
import type { Result } from "@/shared/domain/result";
import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";

// What the browser gets: plain strings, because Temporal values do not cross the server-client boundary
export type NoteView = {
  readonly id: string;
  readonly content: string;
  // ISO instant, for <time dateTime> and for ordering
  readonly createdAt: string;
  // Her clock: "09:12"
  readonly time: string;
};

// What a note action answers: the note as it now is, or the sentence she reads
export type NoteResult = Result<NoteView, string>;

const clock = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: vietnamTimeZone,
});

export function clockTime(epochMilliseconds: number): string {
  return clock.format(epochMilliseconds);
}

const previewLength = 40;

// Enough of a note to tell it apart, for a button's accessible name or a toast: its first line, cut short
export function preview(content: string): string {
  const [firstLine = ""] = content.trim().split("\n");

  return firstLine.length > previewLength ? `${firstLine.slice(0, previewLength)}...` : firstLine;
}

export function toNoteView(note: Note): NoteView {
  return {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt.toString(),
    time: clockTime(note.createdAt.epochMilliseconds),
  };
}
