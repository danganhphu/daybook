import { captureIdSchema } from "@/features/capture/domain/capture";
import { noteIdSchema, type Note } from "@/features/notes/domain/note";
import { contentSchema } from "@/shared/domain/content-schema";
import { searchText } from "@/shared/domain/search-text";
import {
  toAudit,
  toAuditRow,
  toDeletion,
  toDeletionRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { noteTable } from "./note.table";

type NoteRow = typeof noteTable.$inferSelect;

// Rows are parsed back into branded domain values, so a value that slipped past the database's checks fails here
export function toNote(row: NoteRow): Note {
  const fields = {
    id: noteIdSchema.parse(row.id),
    captureId: captureIdSchema.parse(row.captureId),
    content: contentSchema.parse(row.content),
    audit: toAudit(row),
  };
  const deletion = toDeletion(row);

  return deletion === undefined
    ? { ...fields, status: "live" }
    : { ...fields, status: "deleted", deletion };
}

export function toNoteRow(note: Note): NoteRow {
  return {
    id: note.id,
    captureId: note.captureId,
    content: note.content,
    searchText: searchText(note.content),
    ...toAuditRow(note.audit),
    ...toDeletionRow(note.status === "deleted" ? note.deletion : undefined),
  };
}
