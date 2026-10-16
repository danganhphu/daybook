import * as Captures from "../../domain/capture/capture";
import type { CaptureSource } from "../../domain/capture/capture";
import * as Notes from "../../domain/note/note";
import type { LiveNote } from "../../domain/note/note";
import type { Content } from "../../domain/shared/content";
import type { Clock } from "../clock";
import type { StartUnitOfWork } from "../unit-of-work";

export type RecordCaptureDeps = {
  readonly clock: Clock;
  readonly startUnitOfWork: StartUnitOfWork;
};

export type RecordCaptureInput = {
  readonly content: Content;
  readonly source: CaptureSource;
};

// Keeps her words as a capture and, until there is a parser, files them as a note - both or neither
export async function recordCapture(
  deps: RecordCaptureDeps,
  input: RecordCaptureInput,
): Promise<LiveNote> {
  const capture = Captures.receive(input.content, input.source, deps.clock());
  const note = Notes.fromCapture(capture);

  const work = deps.startUnitOfWork();
  work.addCapture(capture);
  work.addNote(note);
  await work.commit();

  return note;
}
