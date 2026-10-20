import type { NoteView } from "./note-view";

// A note as the list shows it: `saving` while the server has not confirmed the change yet
export type ShownNote = NoteView & { readonly saving: boolean };

export type NoteListChange =
  | { readonly kind: "add"; readonly note: NoteView }
  | { readonly kind: "edit"; readonly id: string; readonly content: string }
  | { readonly kind: "remove"; readonly id: string }
  | { readonly kind: "restore"; readonly note: NoteView };

// The optimistic step for each change, oldest first as in a chat. Pure, so useOptimistic can replay it.
export function applyChange(
  notes: ReadonlyArray<ShownNote>,
  change: NoteListChange,
): ReadonlyArray<ShownNote> {
  switch (change.kind) {
    case "add":
      return [...notes, { ...change.note, saving: true }];
    case "edit":
      return notes.map((note) =>
        note.id === change.id ? { ...note, content: change.content, saving: true } : note,
      );
    case "remove":
      return notes.filter((note) => note.id !== change.id);
    case "restore":
      return [...notes, { ...change.note, saving: true }].toSorted((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    default:
      return change satisfies never;
  }
}
