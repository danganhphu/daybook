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

    update(note) {
      const { content, updatedAt, deletedAt } = toNoteRow(note);
      batch.enlist(
        db
          .update(noteTable)
          .set({ content, updatedAt, deletedAt })
          .where(eq(noteTable.id, note.id)),
      );
    },
  };
}
