import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import * as Captures from "@/features/capture/domain/capture";
import type { CaptureSource } from "@/features/capture/domain/capture";
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

export type RecordCaptureInput = {
  readonly content: Content;
  readonly source: CaptureSource;
  readonly authorId: AccountId;
};

// Keeps the user's words as a capture and files them as a note - both or neither. Reading them into an order or a
// reminder comes after, in a request of its own, so saving never waits for a model.
export async function recordCapture(
  deps: RecordCaptureDeps,
  input: RecordCaptureInput,
): Promise<LiveNote> {
  const capture = Captures.receive(input.content, input.source, input.authorId, deps.clock());
  const note = Notes.fromCapture(capture);

  const work = deps.startUnitOfWork();
  work.captures.add(capture);
  work.notes.add(note);
  await work.commit();

  return note;
}
