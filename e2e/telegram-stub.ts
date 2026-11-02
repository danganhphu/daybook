// Stands in for the Bot API in the end-to-end run: no test calls Telegram (ADR 0013, decision 8). It answers every
// method as Telegram would answer a success and appends each call, as a line of JSON, to a file the steps read.
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

import { z } from "zod";

export const stubBotUsername = "daybook_e2e_bot";

const paramsSchema = z.record(z.string(), z.unknown());

// What one call carried: its method, from the path after /bot<token>/, and its parameters
export type StubCall = { readonly method: string; readonly params: Record<string, unknown> };

let nextMessageId = 1;

function resultFor(method: string, params: Record<string, unknown>): unknown {
  switch (method) {
    case "getMe":
      return { id: 1, is_bot: true, first_name: "daybook", username: stubBotUsername };
    case "sendMessage":
      nextMessageId += 1;
      return {
        message_id: nextMessageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: params["chat_id"], type: "private" },
      };
    default:
      return true;
  }
}

export function startTelegramStub(port: number, callsFile: string): Promise<Server> {
  writeFileSync(callsFile, "");
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const method = (request.url ?? "").split("/").at(-1) ?? "";
      const text = Buffer.concat(chunks).toString("utf8");
      const params = text === "" ? {} : paramsSchema.parse(JSON.parse(text));
      appendFileSync(callsFile, `${JSON.stringify({ method, params } satisfies StubCall)}\n`);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, result: resultFor(method, params) }));
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
