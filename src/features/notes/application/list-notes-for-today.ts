import type { Temporal } from "temporal-polyfill/implementation";

import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { Clock } from "@/shared/application/clock";
import { vietnamDate } from "@/shared/domain/vietnam-day";

import { listNotesForDay } from "./list-notes-for-day";

export type ListNotesForTodayDeps = {
  readonly clock: Clock;
  readonly notes: NoteRepository;
};

export type TodaysNotes = {
  readonly day: Temporal.PlainDate;
  // Newest first
  readonly notes: ReadonlyArray<LiveNote>;
};

// "Today" is her day in Vietnam by the injected clock, so it can be tested either side of midnight
export async function listNotesForToday(deps: ListNotesForTodayDeps): Promise<TodaysNotes> {
  const day = vietnamDate(deps.clock());

  return { day, notes: await listNotesForDay(deps, day) };
}
