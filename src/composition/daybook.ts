import { env } from "cloudflare:workers";
import { z } from "zod";

import { appName } from "@/app/identity";
import type { Peppers } from "@/features/access/application/peppers";
import { pepperFitsOrigin } from "@/features/access/infrastructure/development-pepper";
import { pepperSchema, peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import { relyingPartyFor } from "@/features/access/infrastructure/relying-party";
import { vapidPairOrOff } from "@/features/notifications/infrastructure/vapid-config";

import { appOriginBinding, d1Binding } from "./binding-schemas";
import { createApp, type App } from "./create-app";
import { readerBindingsSchema, readerFrom } from "./message-reader";
import { botUsername } from "./telegram-bot-name";
import { telegramConfigOrOff, type TelegramConfig } from "./telegram-config";

// What the web cannot run without; the optional parts (push, the bot) are read apart, so a mistake in one of them
// turns only that part off
const bindingsSchema = z
  .object({ DB: d1Binding, APP_ORIGIN: appOriginBinding, PASSWORD_PEPPER: pepperSchema })
  .extend(readerBindingsSchema.shape)
  .refine((parsed) => pepperFitsOrigin(parsed.PASSWORD_PEPPER, parsed.APP_ORIGIN), {
    error: "PASSWORD_PEPPER is the development pepper, which only localhost may use",
  });

type Bindings = {
  readonly appOrigin: URL;
  // What a browser subscribes with; undefined when push is not configured
  readonly pushPublicKey: string | undefined;
  readonly telegram: TelegramConfig | undefined;
  readonly app: App;
};

let checked: Bindings | undefined;

// Read on first use, not when the module loads: the build imports this module to prerender pages, and there are no
// bindings then. A missing one still fails the first request loudly rather than half-working. The App holds nothing
// per request, so one serves the isolate.
function bindings(): Bindings {
  if (checked === undefined) {
    const parsed = bindingsSchema.parse(env);
    const origin = new URL(parsed.APP_ORIGIN);
    const publicKey = vapidPairOrOff(env, parsed.APP_ORIGIN)?.publicKey;
    const peppers: Peppers = peppersFrom(parsed.PASSWORD_PEPPER);
    checked = {
      appOrigin: origin,
      pushPublicKey: publicKey,
      telegram: telegramConfigOrOff(env, parsed.APP_ORIGIN),
      app: createApp({
        db: parsed.DB,
        relyingParty: relyingPartyFor(origin, appName),
        peppers,
        reader: readerFrom(parsed),
        pushAvailable: publicKey !== undefined,
      }),
    };
  }

  return checked;
}

// Whether this deploy has a bot, so Settings offers Telegram only where it works
export function telegramAvailable(): boolean {
  return bindings().telegram !== undefined;
}

// The bot's username, for a t.me link; undefined where there is no bot or Telegram does not answer
export async function telegramBotUsername(): Promise<string | undefined> {
  const { telegram } = bindings();

  return telegram === undefined ? undefined : botUsername(telegram);
}

// The key a browser subscribes to push with, or undefined where push is not set up
export function pushPublicKey(): string | undefined {
  return bindings().pushPublicKey;
}

// The address the app is served from, as configured - never as a request's Host header claims
export function appOrigin(): URL {
  return bindings().appOrigin;
}

// The app over the Worker's real bindings, for server code: pages and server actions
export function daybook(): App {
  return bindings().app;
}
