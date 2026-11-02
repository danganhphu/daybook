import type { NoteId } from "@/features/notes/domain/note";
import type { AccountId } from "@/shared/domain/account-id";

// A message to read and answer, waiting on the queue. Ids only: her words are read from the book, never carried.
export type ReplyJob = {
  readonly kind: "reply";
  // Who sent it, and so who reads it
  readonly accountId: AccountId;
  readonly noteId: NoteId;
  readonly chatId: number;
  // Her message, which the card answers
  readonly messageId: number;
  // Read once more after a failed reading: Đọc lại
  readonly again: boolean;
  // The card to edit in place, for Đọc lại; a new card otherwise
  readonly cardId?: number | undefined;
};

export type ReplySender = {
  send(jobs: ReadonlyArray<ReplyJob>): Promise<void>;
};
