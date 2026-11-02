import type { SourceRef } from "@/features/capture/domain/capture";
import type { CaptureRepository } from "@/features/capture/domain/capture-repository";
import type { LiveNote, Note } from "@/features/notes/domain/note";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { AccountId } from "@/shared/domain/account-id";
import type { Content } from "@/shared/domain/content";

import { recordCapture, type RecordCaptureDeps } from "./record-capture";

export type RecordMessageDeps = RecordCaptureDeps & {
  readonly captures: CaptureRepository;
  readonly notes: NoteRepository;
};

export type RecordMessageInput = {
  readonly content: Content;
  readonly authorId: AccountId;
  readonly sourceRef: SourceRef;
};

export type RecordedMessage =
  | { readonly kind: "new"; readonly note: LiveNote }
  // Telegram sent it again. Its note may be gone for good while an order made from it keeps the capture: then
  // there is nothing to answer, and recording it again would only clash with the capture that is left.
  | { readonly kind: "seen"; readonly note: Note | undefined };

// A Telegram message, kept once however many times Telegram delivers it (Idempotent Receiver). The key is checked
// here and enforced by a unique index, so two deliveries at once make one capture and a failed request for the other.
export async function recordMessage(
  deps: RecordMessageDeps,
  input: RecordMessageInput,
): Promise<RecordedMessage> {
  const seen = await deps.captures.findBySourceRef("telegram", input.sourceRef);
  if (seen !== undefined) {
    return { kind: "seen", note: await deps.notes.findByCapture(seen.id) };
  }

  return { kind: "new", note: await recordCapture(deps, { ...input, source: "telegram" }) };
}
