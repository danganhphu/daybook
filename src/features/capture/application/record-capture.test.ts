import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createBotApp } from "@/composition/bot-app";
import { telegramSourceRef } from "@/features/capture/domain/capture";
import { anAuthorId, content, testApp, testClock, theAuthor } from "@/testing/support/app";

// A message from Telegram reaches the book through the bot's own composition
function botApp() {
  return createBotApp(
    { db: env.DB, reader: undefined, replies: { send: async () => {} } },
    testClock("2026-10-16T02:00:00Z").clock,
  );
}

describe("recordCapture", () => {
  it("given the user's words, when recorded, then they are filed as a note for that day exactly as typed", async () => {
    const typed = "  bán 2 hộp thuốc tê\ncho chị Lan 500k  ";
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);

    const note = await app.recordCapture({
      content: content(typed),
      source: "web",
      authorId: await theAuthor(),
    });
    const listed = await app.listNotesForDay(Temporal.PlainDate.from("2026-10-16"));

    expect(note.content).toBe(typed);
    expect(listed).toEqual([note]);
  });

  it("given the user's words, when recorded, then the capture keeps them with their source, author and time", async () => {
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);
    const authorId = await theAuthor();

    const note = await app.recordCapture({
      content: content("thuốc tê x2"),
      source: "telegram",
      sourceRef: telegramSourceRef(42, 7),
      authorId,
    });
    const capture = await env.DB.prepare(
      "select content, source, source_ref, author_id, received_at from capture where id = ?",
    )
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({
      content: "thuốc tê x2",
      source: "telegram",
      source_ref: "42:7",
      author_id: authorId,
      received_at: Temporal.Instant.from("2026-10-16T02:00:00Z").epochMilliseconds,
    });
  });

  it("given a Telegram message without its identity, when stored, then the database refuses it", async () => {
    const authorId = await theAuthor();

    await expect(
      env.DB.prepare(
        "insert into capture (id, content, source, author_id, received_at) values (?, 'lạc', 'telegram', ?, 1)",
      )
        .bind("019a0000-0000-7000-8000-0000000000c1", authorId)
        .run(),
    ).rejects.toThrow(/capture_source_ref_by_source/);
  });

  it("given the same Telegram message twice, when recorded as a message, then it is one capture and one note", async () => {
    const bot = botApp();
    const authorId = await theAuthor();
    const message = {
      content: content("thuốc tê x2"),
      authorId,
      sourceRef: telegramSourceRef(42, 7),
    };

    const first = await bot.recordMessage(message);
    const again = await bot.recordMessage(message);
    const counted = await env.DB.prepare(
      "select (select count(*) from capture) as captures, (select count(*) from note) as notes",
    ).first();

    expect(first.kind).toBe("new");
    expect(again).toEqual({ kind: "seen", note: first.note });
    expect(counted).toEqual({ captures: 1, notes: 1 });
  });

  it("given a message whose note is gone for good while its capture stays, when Telegram sends it again, then nothing is recorded and nothing fails", async () => {
    const bot = botApp();
    const authorId = await theAuthor();
    await env.DB.prepare(
      "insert into capture (id, content, source, source_ref, author_id, received_at) values (?, 'thuốc tê x2', 'telegram', '42:7', ?, 1)",
    )
      .bind("019a0000-0000-7000-8000-0000000000c2", authorId)
      .run();

    const again = await bot.recordMessage({
      content: content("thuốc tê x2"),
      authorId,
      sourceRef: telegramSourceRef(42, 7),
    });

    expect(again).toEqual({ kind: "seen", note: undefined });
    expect(await env.DB.prepare("select count(*) as count from capture").first()).toEqual({
      count: 1,
    });
  });

  it("given the same Telegram message recorded twice at once, when the second commits, then the database refuses it", async () => {
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);
    const message = {
      content: content("thuốc tê x2"),
      source: "telegram" as const,
      authorId: await theAuthor(),
      sourceRef: telegramSourceRef(42, 7),
    };

    await app.recordCapture(message);

    await expect(app.recordCapture(message)).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it("given an author with no account, when recorded, then the database refuses it and nothing is stored", async () => {
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);

    await expect(
      app.recordCapture({ content: content("lạc"), source: "web", authorId: anAuthorId }),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    expect(await env.DB.prepare("select count(*) as count from note").first()).toEqual({
      count: 0,
    });
  });
});
