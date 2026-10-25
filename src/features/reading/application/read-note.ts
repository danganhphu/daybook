import type { NoteId } from "@/features/notes/domain/note";
import * as Interpretations from "@/features/reading/domain/interpretation";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";
import { vietnamDate } from "@/shared/domain/vietnam-day";

import type { Message } from "./made-from-reading";
import type { ReadingDeps } from "./reading-deps";
import type { ReadingError } from "./reading-errors";
import { commitSettlement, latestReading, settle, type Settlement } from "./settlement";

export type ReadNoteInput = {
  readonly by: AccountId;
  readonly noteId: NoteId;
  // Read once more a message whose last reading failed
  readonly again: boolean;
};

export type ReadNoteError = Extract<
  ReadingError,
  "note_unavailable" | "reader_unavailable" | "already_read"
>;

// Reads the message a note was filed from - its words as sent, as of the day it was sent - and makes the order or the
// reminder it describes. Read once: again only after a failure, so a message never becomes two orders.
export async function readNote(
  deps: ReadingDeps,
  input: ReadNoteInput,
): Promise<Result<Settlement, ReadNoteError>> {
  const { reader } = deps;
  if (reader === undefined) {
    return err("reader_unavailable");
  }
  const note = await deps.notes.get(input.noteId);
  const capture = note?.status === "live" ? await deps.captures.get(note.captureId) : undefined;
  if (capture === undefined) {
    return err("note_unavailable");
  }

  const { made, latest } = await latestReading(deps, capture.id);
  if (made || (latest !== undefined && !(input.again && latest.outcome === "failed"))) {
    return err("already_read");
  }

  const message: Message = {
    captureId: capture.id,
    content: capture.content,
    day: vietnamDate(capture.receivedAt),
    by: input.by,
  };
  const answer = await reader.read(message.content, message.day);
  const context = {
    captureId: capture.id,
    reader: answer.ok ? answer.value.reader : answer.error.reader,
    readAt: deps.clock(),
    readBy: input.by,
    neurons: answer.ok ? answer.value.neurons : answer.error.neurons,
  };
  const settlement: Settlement = answer.ok
    ? await settle(deps, context, message, answer.value.reading)
    : { interpretation: Interpretations.failed(context, answer.error.failure) };

  return (await commitSettlement(deps, settlement)) === "committed"
    ? ok(settlement)
    : err("already_read");
}
