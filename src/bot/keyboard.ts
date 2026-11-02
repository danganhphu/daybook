import type { InlineKeyboardButton } from "@grammyjs/types";

import { callbackData, type CallbackAction } from "./callback-data";

// The buttons under a card (Bot API, InlineKeyboardMarkup): a tap the bot answers, or a link into the app

export function tap(text: string, action: CallbackAction): InlineKeyboardButton.CallbackButton {
  return { text, callback_data: callbackData(action) };
}

// A page of the app, at the address it is served from
export function urlButton(
  text: string,
  path: string,
  where: { readonly appOrigin: URL },
): InlineKeyboardButton.UrlButton {
  return { text, url: new URL(path, where.appOrigin).toString() };
}

// Buttons laid out `size` to a row
export function rows<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}
