"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Capture from "@/features/capture/web/record-note";
import * as Notes from "@/features/notes/web/commands";
import type { NoteResult } from "@/features/notes/web/note-view";
import * as Reading from "@/features/reading/web/commands";
import type { AnswerView, ReadResult } from "@/features/reading/web/reading-view";
import type { Result } from "@/shared/domain/result";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument.
// A change carries the version the screen showed, so one made from a stale screen is refused, not saved over another.
// Every answer to a change refreshes the page, since vinext would otherwise leave the list as it was: a success
// shows the change, and a refusal almost always means the screen was out of date.

export async function recordNote(text: string): Promise<NoteResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(await Capture.recordNote(app, session.accountId, text));
}

export async function editNote(id: string, version: number, text: string): Promise<NoteResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Notes.editNote(app, session.accountId, id, version, text));
}

export async function deleteNote(id: string, version: number): Promise<NoteResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Notes.deleteNote(app, session.accountId, id, version));
}

export async function restoreNote(id: string, version: number): Promise<NoteResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Notes.restoreNote(app, session.accountId, id, version));
}

// Sent by the page once a note is saved, so typing never waits for the model
export async function readNote(id: string, again: boolean): Promise<ReadResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reading.readNote(app, session.accountId, id, again));
}

export async function answerReading(id: string, answer: AnswerView): Promise<ReadResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reading.answerReading(app, session.accountId, id, answer));
}

// A new note that is refused is only ever the user's words, which the box keeps; nothing else on screen is stale
function refreshOnSuccess(result: NoteResult): NoteResult {
  if (result.ok) {
    refresh();
  }

  return result;
}

function refreshed<T>(result: Result<T, string>): Result<T, string> {
  refresh();

  return result;
}
