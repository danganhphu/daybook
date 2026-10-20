"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import * as Capture from "@/features/capture/web/record-note";
import * as Notes from "@/features/notes/web/commands";
import type { NoteResult } from "@/features/notes/web/note-view";

// Anyone can call a server action, so the commands parse every argument. A successful change refreshes the page;
// without refresh() vinext would leave the list as it was.

export async function recordNote(text: string): Promise<NoteResult> {
  return refreshOnSuccess(await Capture.recordNote(daybook(), text));
}

export async function editNote(id: string, text: string): Promise<NoteResult> {
  return refreshOnSuccess(await Notes.editNote(daybook(), id, text));
}

export async function deleteNote(id: string): Promise<NoteResult> {
  return refreshOnSuccess(await Notes.deleteNote(daybook(), id));
}

export async function restoreNote(id: string): Promise<NoteResult> {
  return refreshOnSuccess(await Notes.restoreNote(daybook(), id));
}

function refreshOnSuccess(result: NoteResult): NoteResult {
  if (result.ok) {
    refresh();
  }

  return result;
}
