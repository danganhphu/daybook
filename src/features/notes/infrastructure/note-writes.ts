import { eq } from "drizzle-orm";

import type { NoteWrites } from "@/features/notes/application/note-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toNoteRow } from "./note-mapping";
import { noteTable } from "./note.table";

export function createNoteWrites(db: Database, batch: Batch): NoteWrites {
  return {
    add(note) {
      batch.enlist(db.insert(noteTable).values(toNoteRow(note)));
    },

    // Everything but the creation, which the database refuses to change; the version trigger refuses a stale write
    update(note) {
      const { content, searchText, updatedAt, updatedBy, version, deletedAt, deletedBy } =
        toNoteRow(note);
      batch.enlist(
        db
          .update(noteTable)
          .set({ content, searchText, updatedAt, updatedBy, version, deletedAt, deletedBy })
          .where(eq(noteTable.id, note.id)),
      );
    },
  };
}
