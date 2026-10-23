import type { NoteId } from "@/features/notes/domain/note";
import type { RecordChange } from "@/shared/application/record-change";

export type NoteChange = RecordChange<NoteId>;
