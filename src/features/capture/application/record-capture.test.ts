import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { anAuthorId, content, testApp, testClock, theAuthor } from "@/testing/support/app";

describe("recordCapture", () => {
  it("given the user's words, when recorded, then they are filed as a note for that day exactly as typed", async () => {
    const typed = "  bán 2 thùng giấy in\ncho chị Lan 500k  ";
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
      content: content("giấy in x2"),
      source: "telegram",
      authorId,
    });
    const capture = await env.DB.prepare(
      "select content, source, author_id, received_at from capture where id = ?",
    )
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({
      content: "giấy in x2",
      source: "telegram",
      author_id: authorId,
      received_at: Temporal.Instant.from("2026-10-16T02:00:00Z").epochMilliseconds,
    });
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
