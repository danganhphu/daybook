import type { Temporal } from "temporal-polyfill/implementation";

import type { LiveNote } from "../../domain/note/note";
import type { NoteRepository } from "../../domain/note/note-repository";
import { vietnamDayBounds } from "../../domain/shared/vietnam-day";

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
