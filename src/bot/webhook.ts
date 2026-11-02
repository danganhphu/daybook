import { errorLines } from "@/shared/infrastructure/error-lines";
import { logEvent } from "@/shared/infrastructure/log-event";

import type { Bot, WebhookAnswer } from "./bot";
import { onCallback } from "./on-callback";
import { onEditedMessage, onMessage } from "./on-message";
import { updateSchema } from "./telegram-update";

// Bot API, setWebhook: secret_token comes back in this header on every update
const secretHeader = "X-Telegram-Bot-Api-Secret-Token";

const encoder = new TextEncoder();

// Compared as SHA-256 digests, so the comparison takes the same time whatever the header's length and wherever it
// differs (ADR 0013, decision 3)
async function fromTelegram(bot: Bot, presented: string | null): Promise<boolean> {
  if (presented === null) {
    return false;
  }
  const [expected, actual] = await Promise.all([
    bot.secrets.sha256(encoder.encode(bot.webhookSecret)),
    bot.secrets.sha256(encoder.encode(presented)),
  ]);

  return bot.secrets.equalInConstantTime(expected, actual);
}

function answered(answer: WebhookAnswer | undefined): Response {
  return answer === undefined ? new Response(null) : Response.json(answer);
}

// Telegram's updates. Nothing is read before the secret matches. An update that cannot be read, or is of a kind the
// bot does not take, is answered 200 so Telegram does not send it again; a failure to keep her words is answered 500,
// so it does, and the resend finds what was kept (Idempotent Receiver).
export async function handleWebhook(
  bot: Bot,
  request: Request,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  if (!(await fromTelegram(bot, request.headers.get(secretHeader)))) {
    return new Response(null, { status: 401 });
  }

  const update = updateSchema.safeParse(await request.json().catch(() => undefined));
  if (!update.success) {
    logEvent("telegram_update_unreadable");
    return answered(undefined);
  }

  try {
    const { message, edited_message: edited, callback_query: query } = update.data;
    if (message !== undefined) {
      return answered(await onMessage(bot, message));
    }
    if (edited !== undefined) {
      return answered(await onEditedMessage(bot, edited));
    }

    return answered(query === undefined ? undefined : await onCallback(bot, query, waitUntil));
  } catch (error) {
    logEvent("telegram_update_failed", {
      update: update.data.update_id,
      errors: errorLines(error),
    });
    return new Response(null, { status: 500 });
  }
}
