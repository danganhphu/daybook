import { z } from "zod";

import { telegramApiOrigin } from "@/bot/fetch-bot-api";
import { secretByteLength } from "@/features/access/domain/access-policy";
import { base64UrlLength } from "@/shared/domain/base64url";
import { errorLines } from "@/shared/infrastructure/error-lines";
import { logEvent } from "@/shared/infrastructure/log-event";

// Bot API, "Authorizing your bot": a token looks like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
const botTokenSchema = z
  .string()
  .regex(/^\d+:[A-Za-z0-9_-]+$/, { error: "TELEGRAM_BOT_TOKEN is not a bot token" });

// setWebhook allows 1-256 of A-Z, a-z, 0-9, _ and -; ours is 256 random bits, base64url, as every secret here is
const webhookSecretSchema = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${base64UrlLength(secretByteLength)},256}$`), {
    error: "TELEGRAM_WEBHOOK_SECRET must be 32 random bytes or more, base64url",
  });

// Not declared for production, so the bot stays optional: a deploy keeps the Worker's secrets that the config does
// not name (cf sends keep_bindings for secrets), while one it names must be set before every deploy
export const telegramBindingsSchema = z.object({
  TELEGRAM_BOT_TOKEN: botTokenSchema.optional(),
  TELEGRAM_WEBHOOK_SECRET: webhookSecretSchema.optional(),
  // The end-to-end build's stand-in for Telegram, declared only in that build
  TELEGRAM_API_ORIGIN: z.url().optional(),
});

export type TelegramConfig = {
  readonly token: string;
  readonly webhookSecret: string;
  readonly apiOrigin: string;
};

// Both secrets or neither: with neither the bot is off, its path answers 404 and Settings offers no Telegram. One
// alone is an error, as a lone VAPID key is. Every call carries the token in its URL, so another API origin is taken
// only where the app itself runs on localhost: one set on a deploy by mistake would send the token there.
export function telegramConfigFrom(
  parsed: z.infer<typeof telegramBindingsSchema>,
  appOrigin: string,
): TelegramConfig | undefined {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: webhookSecret } = parsed;
  if (token === undefined && webhookSecret === undefined) {
    return undefined;
  }
  if (token === undefined || webhookSecret === undefined) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are set together or not at all",
    );
  }
  const apiOrigin = parsed.TELEGRAM_API_ORIGIN ?? telegramApiOrigin;
  if (apiOrigin !== telegramApiOrigin && new URL(appOrigin).hostname !== "localhost") {
    throw new Error(
      "TELEGRAM_API_ORIGIN is for a stand-in of Telegram, which only localhost may use",
    );
  }

  return { token, webhookSecret, apiOrigin };
}

// For the web, the cron and the queue. The bot is optional (ADR 0014), so a bot set up wrongly is turned off and
// says so in the logs, while everything else keeps working: `wrangler secret put` deploys at once, so setting the
// two secrets one at a time runs a version with one of them, which must not take the app down for that moment.
export function telegramConfigOrOff(env: unknown, appOrigin: string): TelegramConfig | undefined {
  try {
    return telegramConfigFrom(telegramBindingsSchema.parse(env), appOrigin);
  } catch (error) {
    logEvent("telegram_misconfigured", { errors: errorLines(error) });
    return undefined;
  }
}
