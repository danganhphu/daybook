import { env } from "cloudflare:workers";
import { z } from "zod";

import type { Bot } from "@/bot/bot";
import { createFetchBotApi } from "@/bot/fetch-bot-api";
import type { ReplySender } from "@/bot/reply-job";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { createQueueJobSender } from "@/features/notifications/infrastructure/queue-job-sender";
import type { MessageReader } from "@/features/reading/application/message-reader";
import type { Clock } from "@/shared/application/clock";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { appOriginBinding, d1Binding, queueBinding } from "./binding-schemas";
import { createBotApp } from "./bot-app";
import { readerBindingsSchema, readerFrom } from "./message-reader";
import { telegramConfigOrOff, type TelegramConfig } from "./telegram-config";

export type BotBindings = {
  readonly db: D1Database;
  readonly reader: MessageReader | undefined;
  readonly replies: ReplySender;
  readonly telegram: TelegramConfig;
  readonly appOrigin: URL;
};

export function createBot(bindings: BotBindings, clock: Clock = systemClock): Bot {
  return {
    app: createBotApp(bindings, clock),
    api: createFetchBotApi({ token: bindings.telegram.token, origin: bindings.telegram.apiOrigin }),
    secrets: webCryptoSecrets,
    webhookSecret: bindings.telegram.webhookSecret,
    appOrigin: bindings.appOrigin,
  };
}

const botBindingsSchema = z
  .object({ DB: d1Binding, JOBS: queueBinding, APP_ORIGIN: appOriginBinding })
  .extend(readerBindingsSchema.shape);

let checked: { readonly bot: Bot | undefined } | undefined;

// The bot over the Worker's real bindings, read on first use as the app's are; undefined where it is not configured,
// or configured wrongly (telegramConfigOrOff says so in the logs), and then its path is not there
export function bot(): Bot | undefined {
  if (checked === undefined) {
    const parsed = botBindingsSchema.parse(env);
    const telegram = telegramConfigOrOff(env, parsed.APP_ORIGIN);
    checked = {
      bot:
        telegram === undefined
          ? undefined
          : createBot({
              db: parsed.DB,
              reader: readerFrom(parsed),
              replies: createQueueJobSender(parsed.JOBS),
              telegram,
              appOrigin: new URL(parsed.APP_ORIGIN),
            }),
    };
  }

  return checked.bot;
}
