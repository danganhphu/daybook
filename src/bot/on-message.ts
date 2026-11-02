import { accessErrorMessages } from "@/features/access/application/access-errors";
import * as TelegramLinks from "@/features/access/domain/telegram-link";
import {
  telegramChatIdSchema,
  telegramUserIdSchema,
  type TelegramLink,
} from "@/features/access/domain/telegram-link";
import { telegramSourceRef } from "@/features/capture/domain/capture";
import { parseContent } from "@/shared/domain/content";
import { routes } from "@/shared/web/routes";

import { say, type Bot, type WebhookAnswer } from "./bot";
import { commandIn, descriptionOf, type CommandCall } from "./bot-commands";
import { botCopy, howTo, linkedTo } from "./bot-copy";
import type { Card, CardContext } from "./cards";
import { escapeHtml } from "./html";
import { linkCard, listedReminders, remindersCard, summaryCard, todayCard } from "./telegram-text";
import { isPrivate, type TelegramMessage } from "./telegram-update";

// How many of the day's orders /today names
const listedOrders = 20;

// Every card goes as HTML, and a name from the book or from Telegram may hold < or &
function plain(text: string): Card {
  return { text: escapeHtml(text), keyboard: [] };
}

function contextOf(bot: Bot): CardContext {
  return { appOrigin: bot.appOrigin, today: bot.app.today() };
}

// /start with a code from Settings: the sender writes as that account from now on
async function linkSender(
  bot: Bot,
  message: TelegramMessage,
  code: string,
): Promise<WebhookAnswer | undefined> {
  const { from, chat } = message;
  const userId = telegramUserIdSchema.safeParse(from?.id);
  const chatId = telegramChatIdSchema.safeParse(chat.id);
  if (from === undefined || !userId.success || !chatId.success) {
    return undefined;
  }

  const linked = await bot.app.linkTelegram({
    code,
    user: { id: userId.data, name: TelegramLinks.nameOf(from.first_name, from.last_name) },
    chatId: chatId.data,
  });
  if (!linked.ok) {
    return say(chat.id, plain(accessErrorMessages[linked.error]));
  }
  const name = (await bot.app.displayName(linked.value.accountId)) ?? linked.value.telegramName;

  return say(chat.id, plain(`${linkedTo(name)}\n\n${howTo()}`));
}

async function today(bot: Bot): Promise<Card> {
  const day = bot.app.today();
  const range = { from: day, to: day };
  const [orders, totals, due] = await Promise.all([
    bot.app.listOrders(range, listedOrders),
    bot.app.orderTotals(range),
    bot.app.dueReminders({ dueBy: day }, listedReminders + 1),
  ]);

  return todayCard({ orders, totals, due }, contextOf(bot));
}

async function command(bot: Bot, sender: TelegramLink, call: CommandCall): Promise<Card> {
  const context = contextOf(bot);
  switch (call.name) {
    case "start":
    case "help":
      return plain(howTo());
    case "today":
      return today(bot);
    case "reminders":
      return remindersCard(await bot.app.dueReminders({}, listedReminders + 1), context);
    case "week":
    case "month":
      return summaryCard(
        await bot.app.periodSummary(sender.accountId, call.name, context.today),
        context,
      );
    case "web":
      return linkCard(descriptionOf("web"), botCopy.openWeb, routes.today, context);
    case "settings":
      return linkCard(descriptionOf("settings"), botCopy.openSettings, routes.settings, context);
    case undefined:
      return plain(botCopy.unknownCommand);
    default:
      return call.name satisfies never;
  }
}

// A message in her chat with the bot. Her words are kept before Telegram gets its answer, and read in the queue: the
// answer only says "typing", and the card follows (ADR 0013, decision 4). A stranger's words are never kept; a
// stranger hears one sentence, on /start.
export async function onMessage(
  bot: Bot,
  message: TelegramMessage,
): Promise<WebhookAnswer | undefined> {
  const { chat, from, text } = message;
  if (!isPrivate(chat) || from === undefined || from.is_bot) {
    return undefined;
  }
  const call = text === undefined ? undefined : commandIn(text);
  if (call?.name === "start" && call.argument !== "") {
    return linkSender(bot, message, call.argument);
  }

  const userId = telegramUserIdSchema.safeParse(from.id);
  const linked = userId.success ? await bot.app.linkFor(userId.data) : undefined;
  if (linked === undefined) {
    return call?.name === "start" ? say(chat.id, plain(botCopy.stranger)) : undefined;
  }
  if (text === undefined) {
    return say(chat.id, plain(botCopy.notText));
  }
  if (call !== undefined) {
    return say(chat.id, await command(bot, linked, call));
  }

  const content = parseContent(text);
  if (!content.ok) {
    return say(chat.id, plain(content.error));
  }
  const { note } = await bot.app.recordMessage({
    content: content.value,
    authorId: linked.accountId,
    sourceRef: telegramSourceRef(chat.id, message.message_id),
  });
  if (note === undefined) {
    return undefined;
  }
  await bot.app.replies.send([
    {
      kind: "reply",
      accountId: linked.accountId,
      noteId: note.id,
      chatId: chat.id,
      messageId: message.message_id,
      again: false,
    },
  ]);

  return { method: "sendChatAction", chat_id: chat.id, action: "typing" };
}

// An edit in Telegram never reaches the note, which keeps the words as first sent
export async function onEditedMessage(
  bot: Bot,
  message: TelegramMessage,
): Promise<WebhookAnswer | undefined> {
  const { chat, from } = message;
  const userId = telegramUserIdSchema.safeParse(from?.id);
  if (!isPrivate(chat) || !userId.success || (await bot.app.linkFor(userId.data)) === undefined) {
    return undefined;
  }

  return say(chat.id, linkCard(botCopy.edited, botCopy.openWeb, routes.today, contextOf(bot)));
}
