import type { App } from "@/composition/create-app";
import { toNoteView, type NoteResult } from "@/features/notes/web/note-view";
import { parseContent } from "@/shared/domain/content";
import { ok } from "@/shared/domain/result";

// Her words from the web box: kept as a capture and filed as the note she sees at once
export async function recordNote(app: App, text: unknown): Promise<NoteResult> {
  const content = parseContent(text);
  if (!content.ok) {
    return content;
  }

  return ok(toNoteView(await app.recordCapture({ content: content.value, source: "web" })));
}
