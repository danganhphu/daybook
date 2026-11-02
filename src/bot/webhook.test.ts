import { describe, expect, it } from "vitest";

import { contentMaxLength } from "@/shared/domain/content";
import { rows } from "@/testing/support/access";
import { content, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";
import {
  aMessage,
  lanOnTelegram,
  seedTelegramLink,
  strangerOnTelegram,
  testBot,
  webhookRequest,
} from "@/testing/support/telegram";

import { handleWebhook } from "./webhook";

// 09:00 in Vietnam
const now = "2026-11-02T02:00:00Z";

async function lanLinked() {
  const time = testClock(now);
  const tested = testBot(time.clock);
  const author = await theAuthor();
  await seedTelegramLink(time.clock, author, lanOnTelegram);

  return { ...tested, time, author };
}

function post(tested: ReturnType<typeof testBot>, update: object, secret?: string | null) {
  return handleWebhook(tested.bot, webhookRequest(update, secret), tested.waitUntil);
}

async function body(response: Response): Promise<unknown> {
  const text = await response.text();

  return text === "" ? undefined : JSON.parse(text);
}

function notes() {
  return rows<{ content: string; created_by: string }>("select content, created_by from note");
}

describe("the webhook, trust", () => {
  it.each([
    ["no secret", null],
    ["a wrong secret", "c29tZS1vdGhlci1zZWNyZXQtdGhhdC1pcy1ub3QtdGhlLW9uZQ"],
  ])(
    "given %s, when an update comes, then it is refused unread and nothing is kept",
    async (_, secret) => {
      const tested = await lanLinked();

      const response = await post(tested, aMessage(lanOnTelegram, "thuốc tê x2"), secret);

      expect(response.status).toBe(401);
      expect(await notes()).toEqual([]);
      expect(tested.replies).toEqual([]);
    },
  );

  it("given a GET, when it comes, then only POST is allowed", async () => {
    const tested = await lanLinked();

    const response = await handleWebhook(
      tested.bot,
      new Request("https://daybook.example.workers.dev/telegram/webhook"),
      tested.waitUntil,
    );

    expect(response.status).toBe(405);
  });

  it("given a body that is not an update, when it comes with the secret, then it is answered 200 so Telegram stops", async () => {
    const tested = await lanLinked();

    const response = await post(tested, { message: "not a message" });

    expect([response.status, await body(response)]).toEqual([200, undefined]);
  });
});

describe("the webhook, her messages", () => {
  it("given a linked Telegram user's message, when it comes, then it is kept as her note, its reading is queued, and Telegram shows typing", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));

    expect(await body(response)).toEqual({
      method: "sendChatAction",
      chat_id: lanOnTelegram.id,
      action: "typing",
    });
    expect(await notes()).toEqual([{ content: "thuốc tê x2", created_by: tested.author }]);
    expect(await rows("select source, source_ref from capture")).toEqual([
      { source: "telegram", source_ref: `${lanOnTelegram.id}:41` },
    ]);
    expect(tested.replies).toEqual([
      {
        kind: "reply",
        accountId: tested.author,
        noteId: expect.any(String),
        chatId: lanOnTelegram.id,
        messageId: 41,
        again: false,
      },
    ]);
  });

  it("given the same message sent again by Telegram, when it comes, then it is one note and its reading is queued again", async () => {
    const tested = await lanLinked();

    await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));
    await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));

    expect(await notes()).toHaveLength(1);
    expect(tested.replies).toHaveLength(2);
    expect(tested.replies[0]?.noteId).toBe(tested.replies[1]?.noteId);
  });

  it("given the queue down, when a message comes, then it is answered 500 and the resend queues it without a second note", async () => {
    const tested = await lanLinked();
    tested.queue.down = true;

    const failed = await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));
    tested.queue.down = false;
    const resent = await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));

    expect([failed.status, resent.status]).toEqual([500, 200]);
    expect(await notes()).toHaveLength(1);
    expect(tested.replies).toHaveLength(1);
  });

  it("given a stranger's message, when it comes, then nothing is kept and nothing is said", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(strangerOnTelegram, "xin chào"));

    expect(await body(response)).toBeUndefined();
    expect(await notes()).toEqual([]);
    expect(tested.replies).toEqual([]);
  });

  it("given a stranger's /start, when it comes, then they hear the one sentence for strangers", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(strangerOnTelegram, "/start"));

    expect(await body(response)).toMatchObject({
      method: "sendMessage",
      chat_id: strangerOnTelegram.id,
      text: "Bot này chỉ dành cho người có tài khoản. Mở Cài đặt trong app để kết nối Telegram.",
    });
  });

  it("given her message in a group, when it comes, then nothing is kept", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41, "group"));

    expect(await body(response)).toBeUndefined();
    expect(await notes()).toEqual([]);
  });

  it("given a photo from her, when it comes, then she is told only text is kept", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(lanOnTelegram, undefined));

    expect(await body(response)).toMatchObject({ text: "Hiện mới ghi được tin chữ." });
    expect(await notes()).toEqual([]);
  });

  it("given a message longer than a note may be, when it comes, then she hears why and nothing is kept", async () => {
    const tested = await lanLinked();

    const response = await post(tested, aMessage(lanOnTelegram, "a".repeat(contentMaxLength + 1)));

    expect(await body(response)).toMatchObject({ text: `Tối đa ${contentMaxLength} ký tự` });
    expect(await notes()).toEqual([]);
  });

  it("given she edits a message in Telegram, when the edit comes, then she is told to change it on the web, and the note keeps the first words", async () => {
    const tested = await lanLinked();
    await post(tested, aMessage(lanOnTelegram, "thuốc tê x2", 41));

    const response = await post(tested, {
      edited_message: aMessage(lanOnTelegram, "thuốc tê x3", 41).message,
    });

    expect(await body(response)).toMatchObject({
      text: "Sửa ở đây không đổi được ghi chú. Mở web để sửa.",
      reply_markup: {
        inline_keyboard: [[{ text: "Mở web", url: "https://daybook.example.workers.dev/" }]],
      },
    });
    expect(await notes()).toEqual([{ content: "thuốc tê x2", created_by: tested.author }]);
  });
});

describe("the webhook, commands", () => {
  it("given an order today and a reminder due, when she sends /today, then both are listed, each reminder with its Xong", async () => {
    const tested = await lanLinked();
    const app = testApp(tested.time.clock);
    const customer = await aCustomer(app, "Nha khoa <Hoa Mai>");
    await anOrder(app, customer, [line("Thuốc tê", 2, 250_000)], "2026-11-02");
    const reminder = expectOk(
      await app.addReminder({
        by: tested.author,
        details: { text: content("gọi lại"), dueOn: tested.bot.app.today(), customerId: undefined },
        fromNote: undefined,
      }),
    );

    const answer = await body(await post(tested, aMessage(lanOnTelegram, "/today")));

    expect(answer).toMatchObject({
      method: "sendMessage",
      parse_mode: "HTML",
      text: expect.stringMatching(
        /1 đơn, 500\.000đ[\s\S]*Nha khoa &lt;Hoa Mai&gt;: Thuốc tê, 500\.000đ[\s\S]*1\. gọi lại/,
      ),
      reply_markup: {
        inline_keyboard: expect.arrayContaining([
          [{ text: "Xong 1", callback_data: `cr:${reminder.id}:1` }],
        ]),
      },
    });
  });

  it("given /week, when she sends it, then she gets the week's summary with a button to the report", async () => {
    const tested = await lanLinked();

    const answer = await body(await post(tested, aMessage(lanOnTelegram, "/week")));

    expect(answer).toMatchObject({ text: "<b>Tuần này: 0 đơn, 0đ</b>\nThu về 0đ. Còn nợ 0đ." });
  });

  it("given a command the bot does not know, when she sends it, then she is pointed to /help and nothing is kept", async () => {
    const tested = await lanLinked();

    const answer = await body(await post(tested, aMessage(lanOnTelegram, "/xyz")));

    expect(answer).toMatchObject({ text: "Không có lệnh này. Gõ /help để xem cách dùng." });
    expect(await notes()).toEqual([]);
  });
});
