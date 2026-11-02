import { expect } from "@playwright/test";

import { answer } from "./confirm";
import { Then, When } from "./fixtures";
import { stubBotUsername } from "./telegram-stub";
import { hoaOnTelegram, lanOnTelegram, strangerOnTelegram } from "./telegram-users";

type OnTelegram = { readonly id: number; readonly firstName: string; readonly lastName: string };

// The t.me link a step found, for a later one to follow; what the webhook last answered; and how many calls the
// stand-in had seen when the message went, so a retry never counts the first attempt's card
const startLink = "telegram start link";
const lastAnswer = "telegram answer";
const callsBefore = "telegram calls before";

// Telegram's message ids are per chat, and the app keeps a message once by its id. A retried scenario runs in a new
// worker, so a counter alone would start again and reuse an id: the clock keeps them apart.
const idsPerMillisecond = 1000;
let sent = 0;

function nextMessageId(): number {
  sent += 1;

  return Date.now() * idsPerMillisecond + (sent % idsPerMillisecond);
}

// A text message in that person's private chat with the bot, as Telegram posts it
function messageFrom(person: OnTelegram, text: string) {
  return {
    message: {
      message_id: nextMessageId(),
      date: Math.floor(Date.now() / 1000),
      chat: { id: person.id, type: "private" },
      from: {
        id: person.id,
        is_bot: false,
        first_name: person.firstName,
        last_name: person.lastName,
      },
      text,
    },
  };
}

Then("tôi thấy nút {string} dẫn tới bot", async ({ page, remembered }, name: string) => {
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`^https://t\\.me/${stubBotUsername}\\?start=`),
  );
  remembered.set(startLink, (await link.getAttribute("href")) ?? "");
});

// Telegram opens the bot on her phone; its Start sends what the link carries
When("Lan bấm Bắt đầu trong Telegram", async ({ telegram, remembered }) => {
  const code = new URL(remembered.get(startLink) ?? "").searchParams.get("start") ?? "";
  const { body } = await telegram.post(messageFrom(lanOnTelegram, `/start ${code}`));
  remembered.set(lastAnswer, JSON.stringify(body));
});

// What rides on the webhook's own answer reaches the chat without a call of the Worker's
Then("bot trả lời Lan {string}", async ({ remembered }, text: string) => {
  expect(JSON.parse(remembered.get(lastAnswer) ?? "null")).toMatchObject({
    method: "sendMessage",
    chat_id: lanOnTelegram.id,
    text: expect.stringContaining(text),
  });
});

// Coming back from Telegram: the page refreshes itself when it is shown again
When("tôi quay lại trang", async ({ page }) => {
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
});

When(
  "tôi đồng ý {string} khi được hỏi {string}",
  async ({ page }, verb: string, question: string) => {
    await answer(page, question, verb);
  },
);

When("Hoa nhắn bot {string}", async ({ telegram, remembered }, text: string) => {
  remembered.set(callsBefore, String(telegram.calls().length));
  const { body } = await telegram.post(messageFrom(hoaOnTelegram, text));
  remembered.set(lastAnswer, JSON.stringify(body));
});

When("người lạ nhắn bot {string}", async ({ telegram, remembered }, text: string) => {
  const { body } = await telegram.post(messageFrom(strangerOnTelegram, text));
  remembered.set(lastAnswer, JSON.stringify(body ?? null));
});

When(
  "ai đó gửi tin {string} của Hoa tới webhook mà không có secret",
  async ({ telegram, remembered }, text: string) => {
    const { status } = await telegram.post(messageFrom(hoaOnTelegram, text), null);
    remembered.set(lastAnswer, String(status));
  },
);

Then("bot đang gõ cho Hoa", async ({ remembered }) => {
  expect(JSON.parse(remembered.get(lastAnswer) ?? "null")).toEqual({
    method: "sendChatAction",
    chat_id: hoaOnTelegram.id,
    action: "typing",
  });
});

Then("bot không trả lời", async ({ remembered }) => {
  expect(JSON.parse(remembered.get(lastAnswer) ?? "null")).toBeNull();
});

Then("webhook từ chối", async ({ remembered }) => {
  expect(remembered.get(lastAnswer)).toBe("401");
});

// The queue's consumer takes the job within seconds locally; a run under load gets more
const cardWithin = 20_000;

// The card comes from the queue's consumer, after the reading: the stand-in for the Bot API is asked to send it
Then("bot gửi Hoa thẻ {string}", async ({ telegram, remembered }, text: string) => {
  const from = Number(remembered.get(callsBefore) ?? "0");
  await expect
    .poll(
      () =>
        telegram
          .calls()
          .slice(from)
          .some(
            (call) =>
              call.method === "sendMessage" &&
              call.params["chat_id"] === hoaOnTelegram.id &&
              String(call.params["text"]).includes(text),
          ),
      { timeout: cardWithin },
    )
    .toBe(true);
});
