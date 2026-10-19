import type { Temporal } from "temporal-polyfill/implementation";

import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import { vietnamDayBounds } from "@/shared/domain/vietnam-day";

export type ListNotesForDayDeps = {
  readonly notes: NoteRepository;
};

// A Vietnamese calendar day, newest first, deleted notes left out
export function listNotesForDay(
  deps: ListNotesForDayDeps,
  day: Temporal.PlainDate,
): Promise<ReadonlyArray<LiveNote>> {
  return deps.notes.listLiveCreatedWithin(vietnamDayBounds(day));
}
