import { describe, expect, it } from "vitest";

import { telegramApiOrigin } from "@/bot/fetch-bot-api";

import { telegramBindingsSchema, telegramConfigFrom, telegramConfigOrOff } from "./telegram-config";

// Made up, in a token's shape but too short to be one, so secret scanners do not take it for a real one
const token = "123456:made-up-for-tests";
const secret = "dGVzdC13ZWJob29rLXNlY3JldC1mb3ItZGF5Ym9vay1vaw";
const deployed = "https://daybook.example.workers.dev";
const both = { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret };

describe("telegramConfigFrom", () => {
  it("given neither secret, when read, then there is no bot", () => {
    expect(telegramConfigFrom(telegramBindingsSchema.parse({}), deployed)).toBeUndefined();
  });

  it("given both, when read, then the bot calls Telegram itself", () => {
    expect(telegramConfigFrom(telegramBindingsSchema.parse(both), deployed)).toEqual({
      token,
      webhookSecret: secret,
      apiOrigin: telegramApiOrigin,
    });
  });

  it("given only one, when read, then it fails loudly rather than run half a bot", () => {
    expect(() =>
      telegramConfigFrom(telegramBindingsSchema.parse({ TELEGRAM_BOT_TOKEN: token }), deployed),
    ).toThrow(/set together or not at all/);
  });

  it.each(["short", `${secret}!`])(
    "given the webhook secret %j, when read, then it is refused",
    (weak) => {
      expect(
        telegramBindingsSchema.safeParse({
          TELEGRAM_BOT_TOKEN: token,
          TELEGRAM_WEBHOOK_SECRET: weak,
        }).success,
      ).toBe(false);
    },
  );

  it("given another API origin on a deploy, when read, then it fails rather than send the token there", () => {
    const elsewhere = { ...both, TELEGRAM_API_ORIGIN: "https://attacker.example" };

    expect(() => telegramConfigFrom(telegramBindingsSchema.parse(elsewhere), deployed)).toThrow(
      /only localhost may use/,
    );
  });

  it("given a stand-in's origin on localhost, when read, then the bot calls it", () => {
    const stub = { ...both, TELEGRAM_API_ORIGIN: "http://127.0.0.1:4174" };

    expect(
      telegramConfigFrom(telegramBindingsSchema.parse(stub), "https://localhost:4173")?.apiOrigin,
    ).toBe("http://127.0.0.1:4174");
  });
});

describe("telegramConfigOrOff", () => {
  it("given only one secret, as between setting the two, when read, then the bot is off and nothing throws", () => {
    expect(telegramConfigOrOff({ TELEGRAM_BOT_TOKEN: token }, deployed)).toBeUndefined();
  });

  it("given a secret that is not one, when read, then the bot is off and nothing throws", () => {
    expect(telegramConfigOrOff({ ...both, TELEGRAM_WEBHOOK_SECRET: "short" }, deployed)).toBe(
      undefined,
    );
  });

  it("given both, when read, then the bot is on", () => {
    expect(telegramConfigOrOff(both, deployed)?.token).toBe(token);
  });
});
