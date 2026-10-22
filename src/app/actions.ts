"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Capture from "@/features/capture/web/record-note";
import * as Notes from "@/features/notes/web/commands";
import type { NoteResult } from "@/features/notes/web/note-view";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument.
// A successful change refreshes the page; without refresh() vinext would leave the list as it was.

export async function recordNote(text: string): Promise<NoteResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshOnSuccess(await Capture.recordNote(app, session.accountId, text));
}

export async function editNote(id: string, text: string): Promise<NoteResult> {
  const app = daybook();
  await requireSession(app);

  return refreshOnSuccess(await Notes.editNote(app, id, text));
}

export async function deleteNote(id: string): Promise<NoteResult> {
  const app = daybook();
  await requireSession(app);

  return refreshOnSuccess(await Notes.deleteNote(app, id));
}

export async function restoreNote(id: string): Promise<NoteResult> {
  const app = daybook();
  await requireSession(app);

  return refreshOnSuccess(await Notes.restoreNote(app, id));
}

function refreshOnSuccess(result: NoteResult): NoteResult {
  if (result.ok) {
    refresh();
  }

  return result;
}
