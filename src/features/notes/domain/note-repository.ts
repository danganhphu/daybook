import type { SearchTerm } from "@/shared/domain/search-text";
import type { DayBounds } from "@/shared/domain/vietnam-day";

import type { LiveNote, Note, NoteId } from "./note";

// Reads only. Writes go through the application's unit of work, so several aggregates can change in one transaction.
export type NoteRepository = {
  get(id: NoteId): Promise<Note | undefined>;
  // Newest first
  listLiveCreatedWithin(bounds: DayBounds): Promise<ReadonlyArray<LiveNote>>;
  // Live notes containing every word of the term, newest first, at most `limit`
  searchLive(term: SearchTerm, limit: number): Promise<ReadonlyArray<LiveNote>>;
};
