import type { LiveNote } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { SearchTerm } from "@/shared/domain/search-term";

// Enough to scroll through on a phone; a longer list means the search should be narrower
export const notesSearchLimit = 50;

export type SearchNotesDeps = {
  readonly notes: NoteRepository;
};

export type NotesFound = {
  // Newest first
  readonly notes: ReadonlyArray<LiveNote>;
  // More matched than are shown
  readonly more: boolean;
};

export async function searchNotes(deps: SearchNotesDeps, term: SearchTerm): Promise<NotesFound> {
  // One more than is shown, to know whether there is more without counting every match
  const matched = await deps.notes.searchLive(term, notesSearchLimit + 1);

  return { notes: matched.slice(0, notesSearchLimit), more: matched.length > notesSearchLimit };
}
