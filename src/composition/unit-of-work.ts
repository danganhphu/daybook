import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import { createCaptureWrites } from "@/features/capture/infrastructure/capture-writes";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import { createNoteWrites } from "@/features/notes/infrastructure/note-writes";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { createBatch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

export type DaybookUnitOfWork = UnitOfWork<{
  readonly captures: CaptureWrites;
  readonly notes: NoteWrites;
}>;

// Every feature's writes go into one batch, so whatever a use case touches commits as one D1 transaction
export function createUnitOfWork(db: Database): DaybookUnitOfWork {
  const batch = createBatch(db);

  return {
    captures: createCaptureWrites(db, batch),
    notes: createNoteWrites(db, batch),
    commit: () => batch.commit(),
  };
}
