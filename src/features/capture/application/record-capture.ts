import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import * as Captures from "@/features/capture/domain/capture";
import type { SourceRef } from "@/features/capture/domain/capture";
import type { NoteWrites } from "@/features/notes/application/note-writes";
import * as Notes from "@/features/notes/domain/note";
import type { LiveNote } from "@/features/notes/domain/note";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { AccountId } from "@/shared/domain/account-id";
import type { Content } from "@/shared/domain/content";

export type RecordCaptureDeps = {
  readonly clock: Clock;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly captures: CaptureWrites;
    readonly notes: NoteWrites;
  }>;
};

// A Telegram message says which one it was; the web has nothing to say
export type RecordCaptureInput = {
  readonly content: Content;
  readonly authorId: AccountId;
} & ({ readonly source: "web" } | { readonly source: "telegram"; readonly sourceRef: SourceRef });

// Keeps the user's words as a capture and files them as a note - both or neither. Reading them into an order or a
// reminder comes after, in a request of its own, so saving never waits for a model.
export async function recordCapture(
  deps: RecordCaptureDeps,
  input: RecordCaptureInput,
): Promise<LiveNote> {
  const now = deps.clock();
  const capture =
    input.source === "web"
      ? Captures.receive(input.content, "web", input.authorId, now)
      : Captures.receive(input.content, "telegram", input.authorId, now, input.sourceRef);
  const note = Notes.fromCapture(capture);

  const work = deps.startUnitOfWork();
  work.captures.add(capture);
  work.notes.add(note);
  await work.commit();

  return note;
}
