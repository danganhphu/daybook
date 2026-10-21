import type {
  AccessEventWrites,
  AccountWrites,
  CeremonyWrites,
  SessionWrites,
  SetupLinkWrites,
} from "@/features/access/application/access-writes";
import {
  createAccessEventWrites,
  createAccountWrites,
  createCeremonyWrites,
  createSessionWrites,
  createSetupLinkWrites,
} from "@/features/access/infrastructure/access-writes";
import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import { createCaptureWrites } from "@/features/capture/infrastructure/capture-writes";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import { createNoteWrites } from "@/features/notes/infrastructure/note-writes";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { createBatch, type Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

export type DaybookUnitOfWork = UnitOfWork<{
  readonly captures: CaptureWrites;
  readonly notes: NoteWrites;
  readonly accounts: AccountWrites;
  readonly sessions: SessionWrites;
  readonly setupLinks: SetupLinkWrites;
  readonly ceremonies: CeremonyWrites;
  readonly accessEvents: AccessEventWrites;
}>;

// Every feature's writes go into one batch, so whatever a use case touches commits as one D1 transaction
export function createUnitOfWork(db: Database, batch: Batch = createBatch(db)): DaybookUnitOfWork {
  return {
    captures: createCaptureWrites(db, batch),
    notes: createNoteWrites(db, batch),
    accounts: createAccountWrites(db, batch),
    sessions: createSessionWrites(db, batch),
    setupLinks: createSetupLinkWrites(db, batch),
    ceremonies: createCeremonyWrites(db, batch),
    accessEvents: createAccessEventWrites(db, batch),
    commit: () => batch.commit(),
  };
}
