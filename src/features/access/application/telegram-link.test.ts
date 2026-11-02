import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createBotApp } from "@/composition/bot-app";
import {
  telegramChatIdSchema,
  telegramNameSchema,
  telegramUserIdSchema,
} from "@/features/access/domain/telegram-link";
import { connectTelegram } from "@/features/access/web/settings-commands";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";
import { lanOnTelegram } from "@/testing/support/telegram";

const start = "2026-11-02T02:00:00Z";

// Shaped like a code, but no code was ever made with it
const unknownCode = "A".repeat(43);

// Lan, signed in just now with her password and no passkey, so her session counts as a recent sign-in
async function lanSignedIn() {
  const time = testClock(start);
  const lan = await seedAccount(time.clock, "lan", "Lan");
  const { session } = await seedSession(time.clock, lan);

  return { time, lan, session, app: testApp(time.clock) };
}

function botApp(time: ReturnType<typeof testClock>) {
  return createBotApp(
    { db: env.DB, reader: undefined, replies: { send: async () => {} } },
    time.clock,
  );
}

function telegramUser(id: number, name = "Lan Nguyễn") {
  return { id: telegramUserIdSchema.parse(id), name: telegramNameSchema.parse(name) };
}

// /start <code> from that Telegram user, in their private chat
function sendStart(
  time: ReturnType<typeof testClock>,
  code: string,
  userId: number = lanOnTelegram.id,
) {
  return botApp(time).linkTelegram({
    code,
    user: telegramUser(userId),
    chatId: telegramChatIdSchema.parse(userId),
  });
}

async function events(kind: string) {
  return rows<{ account_id: string | null; detail: string | null; device_label: string }>(
    "select account_id, detail, device_label from access_event where kind = ? order by occurred_at",
    kind,
  );
}

describe("linking a Telegram user, the code", () => {
  it("given a recent sign-in, when she starts linking, then a code comes back once and only its hash is kept, ten minutes long", async () => {
    const { lan, session, app } = await lanSignedIn();

    const started = expectOk(await app.startTelegramLink(session));
    const kept = await rows<{ account_id: string; code_hash: string; ttl: number }>(
      "select account_id, code_hash, expires_at - created_at as ttl from telegram_link_code",
    );

    expect(started.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(kept).toEqual([{ account_id: lan.id, code_hash: expect.any(String), ttl: 600_000 }]);
    expect(kept[0]?.code_hash).not.toBe(started.code);
  });

  it("given a sign-in six minutes old, when she starts linking, then she is asked to confirm and no code is made", async () => {
    const { time, session, app } = await lanSignedIn();
    time.setTo("2026-11-02T02:06:00Z");

    expect(await app.startTelegramLink(session)).toEqual({ ok: false, error: "step_up_required" });
    expect(await rows("select id from telegram_link_code")).toEqual([]);
  });

  it("given a code she did not use, when she starts again, then the first one stops working", async () => {
    const { time, session, app } = await lanSignedIn();
    const first = expectOk(await app.startTelegramLink(session));
    expectOk(await app.startTelegramLink(session));

    expect(await sendStart(time, first.code)).toEqual({
      ok: false,
      error: "telegram_link_unusable",
    });
    expect(await rows("select id from telegram_link_code")).toHaveLength(1);
  });
});

describe("linking a Telegram user, /start with the code", () => {
  it("given a fresh code, when /start brings it, then that Telegram user writes as Lan, the code is spent, and the log says so", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    const { code } = expectOk(await app.startTelegramLink(session));

    const linked = expectOk(await sendStart(time, code));

    expect(linked).toMatchObject({ accountId: lan.id, telegramUserId: lanOnTelegram.id });
    expect(await app.telegramLink(lan.id)).toEqual(linked);
    expect(await rows("select id from telegram_link_code")).toEqual([]);
    expect(await events("telegram_linked")).toEqual([
      {
        account_id: lan.id,
        detail: `{"telegramUser":"${lanOnTelegram.id}"}`,
        device_label: "Telegram",
      },
    ]);
  });

  it("given a code spent once, when it comes again, then it is refused as any unusable link is", async () => {
    const { time, session, app } = await lanSignedIn();
    const { code } = expectOk(await app.startTelegramLink(session));
    expectOk(await sendStart(time, code));

    expect(await sendStart(time, code, 70_000_002)).toEqual({
      ok: false,
      error: "telegram_link_unusable",
    });
  });

  it("given two /start with one code at once, when both arrive, then one links and the other is refused", async () => {
    const { time, session, app } = await lanSignedIn();
    const { code } = expectOk(await app.startTelegramLink(session));

    const both = await Promise.all([sendStart(time, code), sendStart(time, code)]);

    expect(both.filter((result) => result.ok)).toHaveLength(1);
    expect(await rows("select account_id from telegram_link")).toHaveLength(1);
  });

  it("given a code ten minutes old, when it comes, then it is refused and the log says so for her account", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    const { code } = expectOk(await app.startTelegramLink(session));
    time.setTo("2026-11-02T02:10:00Z");

    expect(await sendStart(time, code)).toEqual({ ok: false, error: "telegram_link_unusable" });
    expect(await events("telegram_link_refused")).toEqual([
      { account_id: lan.id, detail: '{"reason":"expired"}', device_label: "Telegram" },
    ]);
    expect(await rows("select account_id from telegram_link")).toEqual([]);
  });

  it("given words that are no code, when they come, then nothing is linked, logged or counted", async () => {
    const { time } = await lanSignedIn();

    expect(await sendStart(time, "abc")).toEqual({ ok: false, error: "telegram_link_unusable" });
    expect(await events("telegram_link_refused")).toEqual([]);
    expect(await rows("select key from rate_limit")).toEqual([]);
  });

  it("given a Telegram user linked to the other person, when they bring Lan's code, then it is refused and the link stays", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const minhSession = (await seedSession(time.clock, minh)).session;
    expectOk(await sendStart(time, expectOk(await app.startTelegramLink(minhSession)).code));

    const { code } = expectOk(await app.startTelegramLink(session));

    expect(await sendStart(time, code)).toEqual({ ok: false, error: "telegram_user_taken" });
    expect(await rows("select account_id from telegram_link")).toEqual([{ account_id: minh.id }]);
    expect(await events("telegram_link_refused")).toEqual([
      { account_id: lan.id, detail: '{"reason":"taken"}', device_label: "Telegram" },
    ]);
  });

  it("given Lan linked from an old Telegram, when she links a new one, then the new one replaces it", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    expectOk(await sendStart(time, expectOk(await app.startTelegramLink(session)).code));

    expectOk(
      await sendStart(time, expectOk(await app.startTelegramLink(session)).code, 70_000_003),
    );

    expect(await rows("select account_id, telegram_user_id from telegram_link")).toEqual([
      { account_id: lan.id, telegram_user_id: 70_000_003 },
    ]);
  });

  it("given ten tries from one Telegram user in ten minutes, when more come, then they are refused unread and logged once", async () => {
    const { time } = await lanSignedIn();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // oxlint-disable-next-line no-await-in-loop -- one after another, as a person would send them
      await sendStart(time, unknownCode);
    }

    expect(await sendStart(time, unknownCode)).toEqual({ ok: false, error: "rate_limited" });
    expect(await sendStart(time, unknownCode)).toEqual({ ok: false, error: "rate_limited" });
    expect(await events("rate_limited")).toEqual([
      { account_id: null, detail: '{"on":"telegram_link"}', device_label: "Telegram" },
    ]);
  });
});

describe("Settings > Telegram, Kết nối", () => {
  it("given a recent sign-in, when she taps Kết nối, then the page gets a t.me link to the bot carrying the code", async () => {
    const { time, session, app } = await lanSignedIn();

    const { url } = expectOk(await connectTelegram(app, session, "daybook_test_bot"));
    const code = new URL(url).searchParams.get("start") ?? "";

    expect(url).toMatch(/^https:\/\/t\.me\/daybook_test_bot\?start=[A-Za-z0-9_-]{43}$/);
    expectOk(await sendStart(time, code));
  });
});

describe("unlinking a Telegram user", () => {
  it("given a link and a recent sign-in, when she disconnects, then the link goes and the log says so", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    expectOk(await sendStart(time, expectOk(await app.startTelegramLink(session)).code));

    expect(await app.unlinkTelegram(session, origin())).toEqual({ ok: true, value: null });
    expect(await app.telegramLink(lan.id)).toBeUndefined();
    expect(await events("telegram_unlinked")).toHaveLength(1);
  });

  it("given a sign-in six minutes old, when she disconnects, then she is asked to confirm and the link stays", async () => {
    const { time, lan, session, app } = await lanSignedIn();
    expectOk(await sendStart(time, expectOk(await app.startTelegramLink(session)).code));
    time.setTo("2026-11-02T02:06:00Z");

    expect(await app.unlinkTelegram(session, origin())).toEqual({
      ok: false,
      error: "step_up_required",
    });
    expect(await app.telegramLink(lan.id)).toBeDefined();
  });

  it("given no link, when she disconnects, then there is nothing to remove", async () => {
    const { session, app } = await lanSignedIn();

    expect(await app.unlinkTelegram(session, origin())).toEqual({ ok: false, error: "not_found" });
  });
});
