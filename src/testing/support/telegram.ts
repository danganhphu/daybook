import { env } from "cloudflare:workers";

import type { Bot } from "@/bot/bot";
import type { BotApi, BotFailure } from "@/bot/bot-api";
import type { ReplyJob } from "@/bot/reply-job";
import { createBotApp } from "@/composition/bot-app";
import { createUnitOfWork } from "@/composition/unit-of-work";
import * as TelegramLinks from "@/features/access/domain/telegram-link";
import { telegramChatIdSchema, telegramUserIdSchema } from "@/features/access/domain/telegram-link";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { MessageReader } from "@/features/reading/application/message-reader";
import type { Clock } from "@/shared/application/clock";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok } from "@/shared/domain/result";
import { createDatabase } from "@/shared/infrastructure/d1/database";

import { relyingParty } from "./app";

// Made up, in the shapes Telegram uses: a user id, the private chat with them (the same number), the bot's secret
export const lanOnTelegram = { id: 70_000_001, firstName: "Lan", lastName: "Nguyễn" } as const;
export const strangerOnTelegram = { id: 70_000_666, firstName: "Ai", lastName: undefined } as const;
export const testWebhookSecret = "dGVzdC13ZWJob29rLXNlY3JldC1mb3ItZGF5Ym9vay1vaw";

export type BotCallRecord = { readonly method: string; readonly params: Record<string, unknown> };

// Stands in for the Bot API: records every call and answers as told, success by default
export function recordingBotApi() {
  const calls: BotCallRecord[] = [];
  let failure: BotFailure | undefined;
  let nextMessageId = 5000;

  function record(method: string, params: object) {
    calls.push({ method, params: { ...params } });
    return failure === undefined ? undefined : err(failure);
  }

  const api: BotApi = {
    getMe: async () => record("getMe", {}) ?? ok({ username: "daybook_test_bot" }),
    sendMessage: async (params) => {
      nextMessageId += 1;
      return record("sendMessage", params) ?? ok({ messageId: nextMessageId });
    },
    editMessageText: async (params) => record("editMessageText", params) ?? ok(null),
    answerCallbackQuery: async (params) => record("answerCallbackQuery", params) ?? ok(null),
    setWebhook: async (params) => record("setWebhook", params) ?? ok(null),
    setMyCommands: async (params) => record("setMyCommands", params) ?? ok(null),
    setMyDescription: async (params) => record("setMyDescription", params) ?? ok(null),
    setMyShortDescription: async (params) => record("setMyShortDescription", params) ?? ok(null),
  };

  return {
    api,
    calls,
    // Every call from now on fails this way; undefined puts it back
    failWith(next: BotFailure | undefined) {
      failure = next;
    },
  };
}

// The bot over the test's D1, with a fake Bot API, a queue that keeps what it is given, and a waitUntil to settle
export function testBot(clock: Clock, reader?: MessageReader) {
  const telegram = recordingBotApi();
  const replies: ReplyJob[] = [];
  const pending: Promise<unknown>[] = [];
  const queue = { down: false };
  const bot: Bot = {
    app: createBotApp(
      {
        db: env.DB,
        reader,
        replies: {
          async send(jobs) {
            if (queue.down) {
              throw new Error("Queue send failed");
            }
            replies.push(...jobs);
          },
        },
      },
      clock,
    ),
    api: telegram.api,
    secrets: webCryptoSecrets,
    webhookSecret: testWebhookSecret,
    appOrigin: new URL(relyingParty.origin),
  };

  return {
    bot,
    telegram,
    replies,
    // Sending to the queue fails while this is set
    queue,
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
    settled: () => Promise.all(pending.splice(0)),
  };
}

// A Telegram user linked straight through the unit of work, as Settings and /start would leave them
export async function seedTelegramLink(
  clock: Clock,
  accountId: AccountId,
  user: { readonly id: number; readonly firstName: string; readonly lastName?: string | undefined },
) {
  const link = TelegramLinks.link(
    accountId,
    {
      id: telegramUserIdSchema.parse(user.id),
      name: TelegramLinks.nameOf(user.firstName, user.lastName),
    },
    telegramChatIdSchema.parse(user.id),
    clock(),
  );
  const work = createUnitOfWork(createDatabase(env.DB));
  work.telegramLinks.save(link);
  await work.commit();

  return link;
}

let updateId = 1;

type Sender = {
  readonly id: number;
  readonly firstName: string;
  readonly lastName?: string | undefined;
};

function fromOf(user: Sender) {
  return {
    id: user.id,
    is_bot: false,
    first_name: user.firstName,
    ...(user.lastName === undefined ? {} : { last_name: user.lastName }),
  };
}

// An update as Telegram posts it to the webhook, with its secret unless the test gives another, or null for none
export function webhookRequest(update: object, secret: string | null = testWebhookSecret) {
  updateId += 1;

  return new Request(`${relyingParty.origin}/telegram/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === null ? {} : { "X-Telegram-Bot-Api-Secret-Token": secret }),
    },
    body: JSON.stringify({ update_id: updateId, ...update }),
  });
}

// A text message in the sender's private chat with the bot
export function aMessage(
  user: Sender,
  text: string | undefined,
  messageId = 1,
  chatType = "private",
) {
  return {
    message: {
      message_id: messageId,
      date: 1_793_000_000,
      chat: { id: user.id, type: chatType },
      from: fromOf(user),
      ...(text === undefined ? { photo: [] } : { text }),
    },
  };
}

// A tap on a button of a card the bot sent in that chat
export function aTap(user: Sender, data: string, cardId = 900) {
  return {
    callback_query: {
      id: `tap-${updateId}`,
      from: fromOf(user),
      chat_instance: "1",
      message: { message_id: cardId, date: 1_793_000_000, chat: { id: user.id, type: "private" } },
      data,
    },
  };
}
