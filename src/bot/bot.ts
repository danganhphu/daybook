import type { Opts } from "@grammyjs/types";

import type { BotApp } from "@/composition/bot-app";
import type { Secrets } from "@/features/access/application/secrets";

import type { BotApi } from "./bot-api";
import type { Card } from "./cards";

// What every handler of the bot runs on: the book's use cases, the Bot API, and where the web app is
export type Bot = {
  readonly app: BotApp;
  readonly api: BotApi;
  readonly secrets: Secrets;
  // setWebhook's secret_token, which Telegram sends back on every update
  readonly webhookSecret: string;
  readonly appOrigin: URL;
};

// The one Bot API call a webhook's answer may carry (Bot API, "Making requests when getting updates"): it costs no
// request of the Worker's, and its result is never known
export type WebhookAnswer =
  | ({ readonly method: "sendMessage" } & Opts<never>["sendMessage"])
  | ({ readonly method: "sendChatAction" } & Opts<never>["sendChatAction"])
  | ({ readonly method: "answerCallbackQuery" } & Opts<never>["answerCallbackQuery"]);

// A card as sendMessage and editMessageText take it: HTML, no link previews, its buttons
export function cardParams(card: Card) {
  return {
    text: card.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(card.keyboard.length === 0
      ? {}
      : { reply_markup: { inline_keyboard: card.keyboard.map((row) => [...row]) } }),
  } as const;
}

export function say(chatId: number, card: Card): WebhookAnswer {
  return { method: "sendMessage", chat_id: chatId, ...cardParams(card) };
}
