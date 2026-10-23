import type { App } from "@/composition/create-app";
import { toNoteView, type NoteResult } from "@/features/notes/web/note-view";
import type { AccountId } from "@/shared/domain/account-id";
import { parseContent } from "@/shared/domain/content";
import { ok } from "@/shared/domain/result";

// The signed-in user's words from the web box: kept as a capture and filed as the note they see at once
export async function recordNote(
  app: App,
  authorId: AccountId,
  text: unknown,
): Promise<NoteResult> {
  const content = parseContent(text);
  if (!content.ok) {
    return content;
  }

  return ok(
    toNoteView(await app.recordCapture({ content: content.value, source: "web", authorId })),
  );
}
