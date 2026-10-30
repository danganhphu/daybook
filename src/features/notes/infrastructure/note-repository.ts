import { and, desc, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import type { DeletedNote, LiveNote, Note } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { toNote } from "./note-mapping";
import { noteTable } from "./note.table";

function onlyLive(rows: ReadonlyArray<typeof noteTable.$inferSelect>): ReadonlyArray<LiveNote> {
  return rows.map(toNote).filter((note): note is LiveNote => note.status === "live");
}

export function createNoteRepository(db: Database): NoteRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(noteTable).where(eq(noteTable.id, id)).limit(1);

      return row === undefined ? undefined : toNote(row);
    },

    async getMany(ids) {
      const notes: Note[] = [];
      for (let start = 0; start < ids.length; start += d1MaxBoundParameters) {
        // oxlint-disable-next-line no-await-in-loop -- one chunk per query, under D1's bound-parameter limit
        const rows = await db
          .select()
          .from(noteTable)
          .where(inArray(noteTable.id, ids.slice(start, start + d1MaxBoundParameters)));
        notes.push(...rows.map(toNote));
      }

      return notes;
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

      return onlyLive(rows);
    },

    // A scan of the live notes: a substring cannot use an index, and two people's notes stay small
    async searchLive(term, limit) {
      const rows = await db
        .select()
        .from(noteTable)
        .where(
          and(
            isNull(noteTable.deletedAt),
            ...term.split(" ").map((word) => containsLiterally(noteTable.searchText, word)),
          ),
        )
        .orderBy(desc(noteTable.createdAt), desc(noteTable.id))
        .limit(limit);

      return onlyLive(rows);
    },

    async listDeleted(since, limit) {
      const rows = await db
        .select()
        .from(noteTable)
        .where(
          and(isNotNull(noteTable.deletedAt), gte(noteTable.deletedAt, since.epochMilliseconds)),
        )
        .orderBy(desc(noteTable.deletedAt), desc(noteTable.id))
        .limit(limit);

      return rows.map(toNote).filter((note): note is DeletedNote => note.status === "deleted");
    },
  };
}
