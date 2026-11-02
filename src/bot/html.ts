// Text for parse_mode HTML: <, > and & that are not markup must be entities, and " too inside an attribute (Bot API,
// "HTML style"). Every word from the book goes through this; only the bot's own tags do not.
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
