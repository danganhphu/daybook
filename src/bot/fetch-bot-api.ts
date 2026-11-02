import { z } from "zod";

import { err, ok, type Result } from "@/shared/domain/result";
import { logEvent } from "@/shared/infrastructure/log-event";

import type { BotApi, BotFailure } from "./bot-api";

export const telegramApiOrigin = "https://api.telegram.org";

// Long past a normal answer, well inside what a queue consumer or a webhook's waitUntil may take
const callTimeoutMs = 10_000;

const tooManyRequests = 429;
const forbidden = 403;
const firstServerError = 500;

// Bot API, "Making requests": every answer is JSON with `ok`, and a failure carries error_code and description
const answerSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error_code: z.int(),
    description: z.string(),
    parameters: z.object({ retry_after: z.int().optional() }).optional(),
  }),
]);

const meSchema = z.object({ username: z.string().min(1) });

const sentSchema = z.object({ message_id: z.int() });

export type FetchBotApiOptions = {
  readonly token: string;
  // Telegram's, or the end-to-end build's stand-in
  readonly origin: string;
  readonly fetch?: typeof fetch;
};

// A small client of our own (ADR 0013, decision 2): JSON over POST, nothing kept between calls. The token is in the
// URL's path, so neither the URL nor an error carrying it is ever logged.
export function createFetchBotApi(options: FetchBotApiOptions): BotApi {
  const send = options.fetch ?? fetch;

  async function call(method: string, params: object): Promise<Result<unknown, BotFailure>> {
    let response: Response;
    try {
      response = await send(`${options.origin}/bot${options.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(callTimeoutMs),
      });
    } catch (error) {
      // A timeout or a network fault; the error's message may hold the URL, so only its name
      logEvent("bot_call_failed", {
        method,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return err({ kind: "retry", afterSeconds: undefined });
    }

    const answer = answerSchema.safeParse(await response.json().catch(() => undefined));
    if (!answer.success) {
      // A proxy's error page, say
      logEvent("bot_call_unreadable", { method, status: response.status });
      return err({ kind: "retry", afterSeconds: undefined });
    }
    if (answer.data.ok) {
      return ok(answer.data.result);
    }

    const { error_code: code, description, parameters } = answer.data;
    if (code === tooManyRequests || code >= firstServerError) {
      logEvent("bot_call_retry", { method, code, retryAfter: parameters?.retry_after });
      return err({ kind: "retry", afterSeconds: parameters?.retry_after });
    }
    if (code === forbidden) {
      return err({ kind: "blocked" });
    }
    logEvent("bot_call_refused", { method, code });

    return err({ kind: "refused", code, description });
  }

  async function callFor<T>(
    method: string,
    params: object,
    schema: z.ZodType<T>,
  ): Promise<Result<T, BotFailure>> {
    const called = await call(method, params);
    if (!called.ok) {
      return called;
    }
    const parsed = schema.safeParse(called.value);

    return parsed.success
      ? ok(parsed.data)
      : err({ kind: "refused", code: 0, description: `Unexpected ${method} result` });
  }

  async function done(method: string, params: object): Promise<Result<null, BotFailure>> {
    const called = await call(method, params);

    return called.ok ? ok(null) : called;
  }

  return {
    getMe: () => callFor("getMe", {}, meSchema),
    sendMessage: async (params) => {
      const sent = await callFor("sendMessage", params, sentSchema);
      return sent.ok ? ok({ messageId: sent.value.message_id }) : sent;
    },
    editMessageText: (params) => done("editMessageText", params),
    answerCallbackQuery: (params) => done("answerCallbackQuery", params),
    setWebhook: (params) => done("setWebhook", params),
    setMyCommands: (params) => done("setMyCommands", params),
    setMyDescription: (params) => done("setMyDescription", params),
    setMyShortDescription: (params) => done("setMyShortDescription", params),
  };
}
