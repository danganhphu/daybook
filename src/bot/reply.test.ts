import { describe, expect, it } from "vitest";

import type { MessageReader } from "@/features/reading/application/message-reader";
import { rows } from "@/testing/support/access";
import { testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { aLine, anOrderReading, readerOf } from "@/testing/support/readings";
import {
  aMessage,
  lanOnTelegram,
  seedTelegramLink,
  testBot,
  webhookRequest,
} from "@/testing/support/telegram";

import { replyToMessage } from "./reply";
import { handleWebhook } from "./webhook";

const now = "2026-11-02T02:00:00Z";
const ordered = "Hướng Dương thuốc tê x2 500k";
const whose = "chị Lan thuốc tê x2 500k";

const reader = readerOf({
  [ordered]: anOrderReading("Hướng Dương", [aLine("thuốc tê", 2, "500k")]),
  [whose]: anOrderReading("chị Lan", [aLine("thuốc tê", 2, "500k")]),
});

// Her message through the webhook, and the job it queued; null for a Worker with no model bound
async function sent(text: string, withReader: MessageReader | null = reader) {
  const time = testClock(now);
  const tested = testBot(time.clock, withReader ?? undefined);
  const author = await theAuthor();
  await seedTelegramLink(time.clock, author, lanOnTelegram);
  const app = testApp(time.clock);
  await handleWebhook(
    tested.bot,
    webhookRequest(aMessage(lanOnTelegram, text, 41)),
    tested.waitUntil,
  );
  const [job] = tested.replies;
  if (job === undefined) {
    throw new Error("Nothing was queued");
  }

  return { ...tested, app, job, author };
}

function cards(tested: ReturnType<typeof testBot>) {
  return tested.telegram.calls.filter((call) => call.method === "sendMessage");
}

describe("replyToMessage", () => {
  it("given a message that names a customer and what they bought, when its job runs, then the order is made and the card answers her message", async () => {
    const tested = await sent(ordered);
    await aCustomer(tested.app, "Hướng Dương");

    expect(await replyToMessage(tested.bot, tested.job)).toEqual({ kind: "done" });

    const [order] = await rows<{ id: string }>("select id from sales_order");
    expect(cards(tested)).toEqual([
      {
        method: "sendMessage",
        params: {
          chat_id: lanOnTelegram.id,
          reply_parameters: { message_id: 41, allow_sending_without_reply: true },
          text: "<b>Đã ghi đơn</b>\nHướng Dương: thuốc tê x2, 500.000đ\nĐơn thứ 1 tháng này, tổng 500.000đ",
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Hoàn tác", callback_data: `uo:${order?.id}:1` },
                {
                  text: "Mở đơn",
                  url: `https://daybook.example.workers.dev/orders/${order?.id}`,
                },
              ],
            ],
          },
        },
      },
    ]);
  });

  it("given the same job twice, when both run, then there is one order and the second card shows it too", async () => {
    const tested = await sent(ordered);
    await aCustomer(tested.app, "Hướng Dương");

    await replyToMessage(tested.bot, tested.job);
    await replyToMessage(tested.bot, tested.job);

    expect(await rows("select id from sales_order")).toHaveLength(1);
    expect(cards(tested)).toHaveLength(2);
    expect(cards(tested)[1]?.params["text"]).toBe(cards(tested)[0]?.params["text"]);
  });

  it("given Telegram busy, when the job runs, then it waits as long as Telegram asks, and the retry answers without a second order", async () => {
    const tested = await sent(ordered);
    await aCustomer(tested.app, "Hướng Dương");
    tested.telegram.failWith({ kind: "retry", afterSeconds: 7 });

    expect(await replyToMessage(tested.bot, tested.job)).toEqual({
      kind: "retry",
      afterSeconds: 7,
    });
    tested.telegram.failWith(undefined);
    expect(await replyToMessage(tested.bot, tested.job)).toEqual({ kind: "done" });
    expect(await rows("select id from sales_order")).toHaveLength(1);
  });

  it("given she blocked the bot, when the job runs, then it is done: the note is on the web", async () => {
    const tested = await sent(ordered);
    tested.telegram.failWith({ kind: "blocked" });

    expect(await replyToMessage(tested.bot, tested.job)).toEqual({ kind: "done" });
  });

  it("given no model bound, when the job runs, then the card says it is kept, with Xoá", async () => {
    const tested = await sent(ordered, null);

    await replyToMessage(tested.bot, tested.job);

    expect(cards(tested)[0]?.params).toMatchObject({
      text: "Đã lưu.",
      reply_markup: {
        inline_keyboard: [[{ text: "Xoá", callback_data: `dn:${tested.job.noteId}:1` }]],
      },
    });
  });

  it("given a name two customers share, when the job runs, then the card asks whose order it is, a button each", async () => {
    const tested = await sent(whose);
    const lanAnh = await aCustomer(tested.app, "Lan Anh");
    const phuongLan = await aCustomer(tested.app, "Phương Lan", { area: "Quận 3" });

    await replyToMessage(tested.bot, tested.job);

    const note = tested.job.noteId;
    expect(cards(tested)[0]?.params).toMatchObject({
      text: "Đơn này của khách nào?",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Lan Anh", callback_data: `ac:${note}:0:${lanAnh.id.slice(-8)}` },
            {
              text: "Phương Lan, Quận 3",
              callback_data: `ac:${note}:1:${phuongLan.id.slice(-8)}`,
            },
          ],
          [{ text: 'Thêm khách "chị Lan"', callback_data: `an:${note}` }],
          [
            { text: "Chọn khách", url: "https://daybook.example.workers.dev/" },
            { text: "Không phải đơn", callback_data: `ad:${note}` },
          ],
        ],
      },
    });
  });

  it("given the note deleted on the web before its reading, when the job runs, then nothing is read or sent", async () => {
    const tested = await sent(ordered);
    await aCustomer(tested.app, "Hướng Dương");
    const note = await tested.app.listNotesForDay(tested.bot.app.today());
    const [first] = note;
    if (first === undefined) {
      throw new Error("No note");
    }
    await tested.app.deleteNote({ id: first.id, by: tested.author, shown: first.audit.version });

    expect(await replyToMessage(tested.bot, tested.job)).toEqual({ kind: "done" });
    expect(cards(tested)).toEqual([]);
    expect(await rows("select id from sales_order")).toEqual([]);
  });
});
