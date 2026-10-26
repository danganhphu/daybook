import type { Temporal } from "temporal-polyfill/implementation";

import type { SearchTerm } from "@/shared/domain/search-text";
import type { DayBounds } from "@/shared/domain/vietnam-day";

import type { DeletedNote, LiveNote, Note, NoteId } from "./note";

// Reads only. Writes go through the application's unit of work, so several aggregates can change in one transaction.
export type NoteRepository = {
  get(id: NoteId): Promise<Note | undefined>;
  // Newest first
  listLiveCreatedWithin(bounds: DayBounds): Promise<ReadonlyArray<LiveNote>>;
  // Live notes containing every word of the term, newest first, at most `limit`
  searchLive(term: SearchTerm, limit: number): Promise<ReadonlyArray<LiveNote>>;
  // Deleted at or after `since`, latest first, at most `limit`
  listDeleted(since: Temporal.Instant, limit: number): Promise<ReadonlyArray<DeletedNote>>;
};
