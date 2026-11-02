// Points the Telegram bot at the app, once per deploy origin and whenever its commands change. Only when asked.
//   pnpm telegram:setup --origin <app URL> [--dry-run] [--drop-pending]
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment: the same two values the Worker has as
// secrets. --dry-run prints what it would send, with both masked, and sends nothing. Messages Telegram holds for a
// webhook that was failing are kept and delivered; --drop-pending throws them away, which loses her words.
import { parseArgs } from "node:util";

import { z } from "zod";

import type { BotApi, BotCall } from "@/bot/bot-api";
import { botCommands } from "@/bot/bot-commands";
import { createFetchBotApi } from "@/bot/fetch-bot-api";
import { allowedUpdates } from "@/bot/telegram-update";
import { webhookPath } from "@/bot/webhook-path";
import { telegramBindingsSchema, telegramConfigFrom } from "@/composition/telegram-config";
import { ok } from "@/shared/domain/result";

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "drop-pending": { type: "boolean", default: false },
  },
});

const origin = z.url({ protocol: /^https$/ }).parse(values.origin);
const config = telegramConfigFrom(telegramBindingsSchema.parse(process.env), origin);
if (config === undefined) {
  throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in this shell first");
}

// Bot API, setMyDescription: 0-512 characters, shown in an empty chat; setMyShortDescription: 0-120, on the profile
const description =
  "Ghi đơn và việc cần nhắc bằng một tin nhắn, như ghi chú. Chỉ dành cho người có tài khoản: kết nối trong Cài đặt của app.";
const shortDescription = "Ghi đơn và việc cần nhắc bằng tin nhắn";

// Two people write to the bot; Telegram's default is 40 connections at once
const maxConnections = 10;

const masked = "<hidden>";

function print(method: string, params: object): BotCall<null> {
  console.log(JSON.stringify({ method, params }, null, 2));
  return Promise.resolve(ok(null));
}

// What the setup would send, printed instead: the token and the webhook's secret never reach the screen
function printingApi(): BotApi {
  return {
    getMe: () => Promise.resolve(ok({ username: masked })),
    sendMessage: () => Promise.resolve(ok({ messageId: 0 })),
    editMessageText: (params) => print("editMessageText", params),
    answerCallbackQuery: (params) => print("answerCallbackQuery", params),
    setWebhook: (params) => print("setWebhook", { ...params, secret_token: masked }),
    setMyCommands: (params) => print("setMyCommands", params),
    setMyDescription: (params) => print("setMyDescription", params),
    setMyShortDescription: (params) => print("setMyShortDescription", params),
  };
}

const api = values["dry-run"]
  ? printingApi()
  : createFetchBotApi({ token: config.token, origin: config.apiOrigin });

// The failure as Telegram described it; it never carries the token
async function step(name: string, call: () => BotCall<null>): Promise<void> {
  const result = await call();
  if (!result.ok) {
    throw new Error(`${name} failed: ${JSON.stringify(result.error)}`);
  }
}

const me = await api.getMe();
if (!me.ok) {
  throw new Error(`getMe failed: the token is wrong or Telegram is unreachable (${me.error.kind})`);
}

await step("setWebhook", () =>
  api.setWebhook({
    url: new URL(webhookPath, origin).toString(),
    secret_token: config.webhookSecret,
    allowed_updates: [...allowedUpdates],
    drop_pending_updates: values["drop-pending"],
    max_connections: maxConnections,
  }),
);
await step("setMyCommands", () => api.setMyCommands({ commands: botCommands }));
await step("setMyDescription", () => api.setMyDescription({ description }));
await step("setMyShortDescription", () =>
  api.setMyShortDescription({ short_description: shortDescription }),
);

console.log(
  values["dry-run"]
    ? "Dry run: nothing was sent."
    : `@${me.value.username} now posts to ${new URL(webhookPath, origin).toString()}`,
);
