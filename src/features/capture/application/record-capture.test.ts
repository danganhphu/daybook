import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { content, testApp, testClock } from "@/testing/support/app";

describe("recordCapture", () => {
  it("given her words, when recorded, then they are filed as a note for that day exactly as typed", async () => {
    const typed = "  bán 2 hộp gel tê\ncho PK chị Lan 500k  ";
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);

    const note = await app.recordCapture({ content: content(typed), source: "web" });
    const listed = await app.listNotesForDay(Temporal.PlainDate.from("2026-10-16"));

    expect(note.content).toBe(typed);
    expect(listed).toEqual([note]);
  });

  it("given her words, when recorded, then the capture keeps them with their source and time", async () => {
    const app = testApp(testClock("2026-10-16T02:00:00Z").clock);

    const note = await app.recordCapture({ content: content("gel tê x2"), source: "telegram" });
    const capture = await env.DB.prepare(
      "select content, source, received_at from capture where id = ?",
    )
      .bind(note.captureId)
      .first();

    expect(capture).toEqual({
      content: "gel tê x2",
      source: "telegram",
      received_at: Temporal.Instant.from("2026-10-16T02:00:00Z").epochMilliseconds,
    });
  });
});
