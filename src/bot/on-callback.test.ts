import { describe, expect, it } from "vitest";

import { orderIdSchema } from "@/features/orders/domain/order";
import { versionSchema } from "@/shared/domain/audit";
import { rows } from "@/testing/support/access";
import { content, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { aLine, anOrderReading, readerOf } from "@/testing/support/readings";
import { expectOk } from "@/testing/support/result";
import {
  aMessage,
  aTap,
  lanOnTelegram,
  seedTelegramLink,
  strangerOnTelegram,
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

// Lan linked, her message sent and answered with its card
async function answered(text: string, before?: (app: ReturnType<typeof testApp>) => Promise<void>) {
  const time = testClock(now);
  const tested = testBot(time.clock, reader);
  const author = await theAuthor();
  await seedTelegramLink(time.clock, author, lanOnTelegram);
  const app = testApp(time.clock);
  await before?.(app);
  await handleWebhook(
    tested.bot,
    webhookRequest(aMessage(lanOnTelegram, text, 41)),
    tested.waitUntil,
  );
  const [job] = tested.replies;
  if (job === undefined) {
    throw new Error("Nothing was queued");
  }
  await replyToMessage(tested.bot, job);

  return { ...tested, app, author, noteId: job.noteId };
}

type Tested = Awaited<ReturnType<typeof answered>>;

// A tap, the answer Telegram gets at once, and the card as redrawn after
async function tap(
  tested: Tested,
  data: string,
  user: typeof lanOnTelegram | typeof strangerOnTelegram = lanOnTelegram,
) {
  const response = await handleWebhook(
    tested.bot,
    webhookRequest(aTap(user, data)),
    tested.waitUntil,
  );
  await tested.settled();
  const edits = tested.telegram.calls.filter((call) => call.method === "editMessageText");

  return { answer: await response.json(), card: edits.at(-1)?.params };
}

async function orderId(): Promise<string> {
  const [order] = await rows<{ id: string }>("select id from sales_order");
  if (order === undefined) {
    throw new Error("No order");
  }

  return order.id;
}

async function orderState() {
  return rows<{ deleted: number; version: number }>(
    "select deleted_at is not null as deleted, version from sales_order",
  );
}

const huongDuong = async (app: ReturnType<typeof testApp>) => {
  await aCustomer(app, "Hướng Dương");
};

describe("the card's buttons, an order", () => {
  it("given an order's card, when she taps Hoàn tác, then the order goes to the trash and the card offers it back", async () => {
    const tested = await answered(ordered, huongDuong);
    const id = await orderId();

    const { answer, card } = await tap(tested, `uo:${id}:1`);

    expect(answer).toEqual({
      method: "answerCallbackQuery",
      callback_query_id: expect.any(String),
    });
    expect(await orderState()).toEqual([{ deleted: 1, version: 2 }]);
    expect(card).toMatchObject({
      chat_id: lanOnTelegram.id,
      message_id: 900,
      text: "Đã xoá đơn.",
      reply_markup: { inline_keyboard: [[{ text: "Khôi phục", callback_data: `ko:${id}:2` }]] },
    });
  });

  it("given the order changed on the web since the card, when she taps Hoàn tác, then nothing changes and she is told why", async () => {
    const tested = await answered(ordered, huongDuong);
    const id = orderIdSchema.parse(await orderId());
    expectOk(
      await tested.app.deleteOrder({ id, by: tested.author, shown: versionSchema.parse(1) }),
    );
    expectOk(
      await tested.app.restoreOrder({ id, by: tested.author, shown: versionSchema.parse(2) }),
    );

    const { answer, card } = await tap(tested, `uo:${id}:1`);

    expect(answer).toMatchObject({
      text: "Đơn này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
    });
    expect(card).toBeUndefined();
    expect(await orderState()).toEqual([{ deleted: 0, version: 3 }]);
  });

  it("given an order undone, when she taps Khôi phục, then it is back and so is its card", async () => {
    const tested = await answered(ordered, huongDuong);
    const id = await orderId();
    await tap(tested, `uo:${id}:1`);

    const { card } = await tap(tested, `ko:${id}:2`);

    expect(await orderState()).toEqual([{ deleted: 0, version: 3 }]);
    expect(card).toMatchObject({ text: expect.stringContaining("Đã ghi đơn") });
  });

  it("given a stranger, when they tap a button of her card, then Telegram gets its answer and nothing changes", async () => {
    const tested = await answered(ordered, huongDuong);
    const id = await orderId();

    const { card } = await tap(tested, `uo:${id}:1`, strangerOnTelegram);

    expect(card).toBeUndefined();
    expect(await orderState()).toEqual([{ deleted: 0, version: 1 }]);
  });

  it("given data the bot never wrote, when it comes, then Telegram gets its answer and nothing changes", async () => {
    const tested = await answered(ordered, huongDuong);

    const { answer, card } = await tap(tested, "uo:'; drop table sales_order; --:1");

    expect(answer).toEqual({
      method: "answerCallbackQuery",
      callback_query_id: expect.any(String),
    });
    expect(card).toBeUndefined();
    expect(await orderState()).toHaveLength(1);
  });
});

describe("the card's buttons, a note", () => {
  it("given a note's card, when she taps Xoá, then it asks first, and Huỷ brings the card back", async () => {
    const tested = await answered("gọi lại sau");

    const question = await tap(tested, `dn:${tested.noteId}:1`);
    const kept = await tap(tested, `vn:${tested.noteId}`);

    expect(question.card).toMatchObject({
      text: "Xoá ghi chú này?",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Xoá", callback_data: `xn:${tested.noteId}:1`, style: "danger" },
            { text: "Huỷ", callback_data: `vn:${tested.noteId}` },
          ],
        ],
      },
    });
    expect(kept.card).toMatchObject({ text: "Đã lưu." });
    expect(await rows("select id from note where deleted_at is null")).toHaveLength(1);
  });

  it("given the question, when she taps its Xoá, then the note goes to the trash and the card offers it back", async () => {
    const tested = await answered("gọi lại sau");

    const { card } = await tap(tested, `xn:${tested.noteId}:1`);

    expect(card).toMatchObject({
      text: "Đã xoá ghi chú.",
      reply_markup: {
        inline_keyboard: [[{ text: "Khôi phục", callback_data: `kn:${tested.noteId}:2` }]],
      },
    });
    expect(await rows("select id from note where deleted_at is null")).toEqual([]);
  });
});

// A name two customers share: the card asks whose order it is
async function asked() {
  const customers: Array<{ id: string }> = [];
  const tested = await answered(whose, async (app) => {
    customers.push(await aCustomer(app, "Lan Anh"), await aCustomer(app, "Phương Lan"));
  });

  return { tested, customers };
}

describe("the card's buttons, whose order", () => {
  it("given two customers to choose from, when she taps the second, then the order is theirs", async () => {
    const { tested, customers } = await asked();
    const second = customers[1]?.id ?? "";

    const { card } = await tap(tested, `ac:${tested.noteId}:1:${second.slice(-8)}`);

    expect(await rows("select customer_id from sales_order")).toEqual([{ customer_id: second }]);
    expect(card).toMatchObject({ text: expect.stringContaining("Phương Lan") });
  });

  it("given a button whose customer is not the one in that place now, when she taps it, then no order is made", async () => {
    const { tested, customers } = await asked();
    const first = customers[0]?.id ?? "";

    const { answer } = await tap(tested, `ac:${tested.noteId}:1:${first.slice(-8)}`);

    expect(answer).toMatchObject({ text: "Tin này đã được trả lời rồi." });
    expect(await rows("select id from sales_order")).toEqual([]);
  });

  it("given the question, when she taps Không phải đơn, then it stays a note", async () => {
    const { tested } = await asked();

    const { card } = await tap(tested, `ad:${tested.noteId}`);

    expect(await rows("select id from sales_order")).toEqual([]);
    expect(card).toMatchObject({ text: "Đã lưu." });
  });
});

describe("the morning list's Xong", () => {
  it("given a reminder due, when she taps its Xong, then it is done, and a second tap changes nothing", async () => {
    const tested = await answered("gọi lại sau");
    const reminder = expectOk(
      await tested.app.addReminder({
        by: tested.author,
        details: { text: content("gọi lại"), dueOn: tested.bot.app.today(), customerId: undefined },
        fromNote: undefined,
      }),
    );

    const first = await tap(tested, `cr:${reminder.id}:1`);
    const second = await tap(tested, `cr:${reminder.id}:1`);

    expect(first.answer).toMatchObject({ text: "Đã xong việc này." });
    expect(second.answer).toMatchObject({
      text: "Việc này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
    });
    expect(await rows("select done_at is not null as done from reminder")).toEqual([{ done: 1 }]);
  });
});

describe("Đọc lại", () => {
  it("given a card, when she taps Đọc lại, then the note is queued to be read again and that card redrawn", async () => {
    const tested = await answered("gọi lại sau");

    const { answer } = await tap(tested, `rn:${tested.noteId}`);

    expect(answer).toMatchObject({ text: "Đang đọc tin..." });
    expect(tested.replies.at(-1)).toMatchObject({
      noteId: tested.noteId,
      again: true,
      cardId: 900,
    });
  });
});
