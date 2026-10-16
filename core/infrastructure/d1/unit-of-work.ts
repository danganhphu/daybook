import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { UnitOfWork } from "../../application/unit-of-work";
import { captureTable } from "./capture.table";
import type { Database } from "./database";
import { toNoteRow } from "./note-mapping";
import { noteTable } from "./note.table";

// D1 has no interactive transactions; a batch is its transaction. Writes are queued and sent as one on commit.
export function createUnitOfWork(db: Database): UnitOfWork {
  const pending: BatchItem<"sqlite">[] = [];

  return {
    addCapture(capture) {
      pending.push(
        db.insert(captureTable).values({
          id: capture.id,
          content: capture.content,
          source: capture.source,
          receivedAt: capture.receivedAt.epochMilliseconds,
        }),
      );
    },

    addNote(note) {
      pending.push(db.insert(noteTable).values(toNoteRow(note)));
    },

    updateNote(note) {
      const { content, updatedAt, deletedAt } = toNoteRow(note);
      pending.push(
        db
          .update(noteTable)
          .set({ content, updatedAt, deletedAt })
          .where(eq(noteTable.id, note.id)),
      );
    },

    async commit() {
      const [first, ...rest] = pending.splice(0);
      if (first === undefined) {
        return;
      }

      await db.batch([first, ...rest]);
    },
  };
}
