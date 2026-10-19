import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";

import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toNote } from "./note-mapping";
import { noteTable } from "./note.table";

export function createNoteRepository(db: Database): NoteRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(noteTable).where(eq(noteTable.id, id)).limit(1);

      return row === undefined ? undefined : toNote(row);
    },

    async listLiveCreatedWithin({ start, end }) {
      const rows = await db
        .select()
        .from(noteTable)
        .where(
          and(
            isNull(noteTable.deletedAt),
            gte(noteTable.createdAt, start.epochMilliseconds),
            lt(noteTable.createdAt, end.epochMilliseconds),
          ),
        )
        // UUIDv7 ids sort by creation, which settles notes created in the same millisecond
        .orderBy(desc(noteTable.createdAt), desc(noteTable.id));

      return rows.map(toNote).filter((note): note is LiveNote => note.status === "live");
    },
  };
}
