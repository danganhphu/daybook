import { createFetchBotApi } from "@/bot/fetch-bot-api";

import type { TelegramConfig } from "./telegram-config";

let known: string | undefined;

// The bot's username, for t.me links, asked of Telegram once per isolate rather than configured, so it cannot drift
// from the token. Undefined while Telegram does not answer; only an answer is kept.
export async function botUsername(config: TelegramConfig): Promise<string | undefined> {
  if (known !== undefined) {
    return known;
  }
  const me = await createFetchBotApi({ token: config.token, origin: config.apiOrigin }).getMe();
  if (me.ok) {
    known = me.value.username;
  }

  return known;
}
