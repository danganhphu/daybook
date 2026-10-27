import type { z } from "zod";

import { err, ok, type Result } from "./result";

// Generous for a note, far below D1's 100 KB statement limit
export const contentMaxLength = 4000;

// What the user typed. Blank is not input, so it is the only thing refused; everything else is kept verbatim. Only
// obtainable by parsing, so nothing downstream can receive unchecked text.
export type Content = string & z.$brand<"Content">;

function isContent(text: string): text is Content {
  return text.length <= contentMaxLength && text.trim().length > 0;
}

// The same check on the server and in the browser, answering with the sentence the user reads when it fails
export function parseContent(text: unknown): Result<Content, string> {
  if (typeof text !== "string") {
    return err("Nội dung phải là chữ");
  }
  if (isContent(text)) {
    return ok(text);
  }

  return err(
    text.length > contentMaxLength ? `Tối đa ${contentMaxLength} ký tự` : "Chưa có nội dung",
  );
}
