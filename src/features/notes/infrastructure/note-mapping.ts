import { Temporal } from "temporal-polyfill/implementation";

import { captureIdSchema } from "@/features/capture/domain/capture";
import { noteIdSchema, type Note } from "@/features/notes/domain/note";
import { contentSchema } from "@/shared/domain/content";

import type { noteTable } from "./note.table";

type NoteRow = typeof noteTable.$inferSelect;

// Rows are parsed back into branded domain values, so a value that slipped past the database's checks fails here
export function toNote(row: NoteRow): Note {
  const fields = {
    id: noteIdSchema.parse(row.id),
    captureId: captureIdSchema.parse(row.captureId),
    content: contentSchema.parse(row.content),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updatedAt),
  };

  return row.deletedAt === null
    ? { ...fields, status: "live" }
    : {
        ...fields,
        status: "deleted",
        deletedAt: Temporal.Instant.fromEpochMilliseconds(row.deletedAt),
      };
}

export function toNoteRow(note: Note): NoteRow {
  return {
    id: note.id,
    captureId: note.captureId,
    content: note.content,
    createdAt: note.createdAt.epochMilliseconds,
    updatedAt: note.updatedAt.epochMilliseconds,
    deletedAt: note.status === "deleted" ? note.deletedAt.epochMilliseconds : null,
  };
}
