import { describe, expect, it } from "vitest";

import { createFetchBotApi } from "./fetch-bot-api";

const token = "123456:test-token";

type Seen = { url: string; init: RequestInit | undefined };

// Stands in for fetch: records the request and answers as told
function answering(answer: () => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetched: typeof fetch = async (input, init) => {
    seen.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return answer();
  };

  return {
    seen,
    api: createFetchBotApi({ token, origin: "https://telegram.test", fetch: fetched }),
  };
}

describe("createFetchBotApi", () => {
  it("given a message to send, when sent, then it is a JSON POST to the method, and the message id comes back", async () => {
    const { seen, api } = answering(() =>
      Response.json({
        ok: true,
        result: { message_id: 77, date: 0, chat: { id: 1, type: "private" } },
      }),
    );

    const sent = await api.sendMessage({ chat_id: 1, text: "Đã lưu." });

    expect(sent).toEqual({ ok: true, value: { messageId: 77 } });
    expect(seen[0]?.url).toBe(`https://telegram.test/bot${token}/sendMessage`);
    expect(seen[0]?.init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: 1, text: "Đã lưu." }),
    });
  });

  it("given flood control, when Telegram answers 429, then it is retried after Telegram's wait", async () => {
    const { api } = answering(() =>
      Response.json(
        {
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 7 },
        },
        { status: 429 },
      ),
    );

    expect(await api.answerCallbackQuery({ callback_query_id: "1" })).toEqual({
      ok: false,
      error: { kind: "retry", afterSeconds: 7 },
    });
  });

  it("given she blocked the bot, when Telegram answers 403, then nothing will reach her", async () => {
    const { api } = answering(() =>
      Response.json(
        { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
        { status: 403 },
      ),
    );

    expect(await api.sendMessage({ chat_id: 1, text: "x" })).toEqual({
      ok: false,
      error: { kind: "blocked" },
    });
  });

  it("given a bad request, when Telegram answers 400, then it is refused, not retried", async () => {
    const { api } = answering(() =>
      Response.json({ ok: false, error_code: 400, description: "Bad Request" }, { status: 400 }),
    );

    expect(await api.sendMessage({ chat_id: 1, text: "x" })).toEqual({
      ok: false,
      error: { kind: "refused", code: 400, description: "Bad Request" },
    });
  });

  it.each([
    ["the network fails", () => Promise.reject(new TypeError("Network connection lost"))],
    ["a proxy answers with a page", () => new Response("<html>502</html>", { status: 502 })],
    [
      "Telegram fails",
      () => Response.json({ ok: false, error_code: 502, description: "Bad Gateway" }),
    ],
  ])("given %s, when called, then it is retried", async (_, answer) => {
    const { api } = answering(answer);

    expect(await api.sendMessage({ chat_id: 1, text: "x" })).toEqual({
      ok: false,
      error: { kind: "retry", afterSeconds: undefined },
    });
  });
});
