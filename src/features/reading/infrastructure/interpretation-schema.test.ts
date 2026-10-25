import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { recordNote, testApp, testClock, theAuthor } from "@/testing/support/app";

// Guards the hand-written parts of the interpretation migration: STRICT, the checks a hand-written insert could
// slip past, the triggers that keep it append-only, and the one that keeps a settled capture settled

const reading = JSON.stringify({ reading: { kind: "note" } });

async function aCapture() {
  const app = testApp(testClock("2026-10-25T01:00:00Z").clock);
  const note = await recordNote(app, "nhớ mang catalogue");

  return { captureId: note.captureId, by: await theAuthor() };
}

type Row = {
  readonly outcome?: unknown;
  readonly result?: unknown;
  readonly failure?: unknown;
  readonly neurons?: unknown;
};

async function insert(
  row: Row,
  id = "019a0000-0000-7000-8000-0000000000e1",
  capture?: Awaited<ReturnType<typeof aCapture>>,
) {
  const { captureId, by } = capture ?? (await aCapture());
  const values = { outcome: "note", result: reading, failure: null, neurons: 7.7, ...row };

  await env.DB.prepare(
    "insert into interpretation (id, capture_id, model, prompt_version, outcome, result, failure, neurons, read_at, read_by) values (?, ?, 'm', 1, ?, ?, ?, ?, 1, ?)",
  )
    .bind(id, captureId, values.outcome, values.result, values.failure, values.neurons, by)
    .run();

  return id;
}

describe("interpretation table", () => {
  it("given a well-formed row, when inserted, then it is stored", async () => {
    await expect(insert({})).resolves.toBeDefined();
  });

  it.each([
    [{ outcome: "guess" }, /interpretation_outcome_known/],
    [{ outcome: "failed", result: null, failure: "bored" }, /interpretation_failure_known/],
    [{ outcome: "failed", result: null, failure: null }, /interpretation_result_or_failure/],
    [{ outcome: "failed", failure: "schema" }, /interpretation_result_or_failure/],
    [{ failure: "schema" }, /interpretation_result_or_failure/],
    [{ result: null }, /interpretation_result_or_failure/],
    [{ result: "{not json" }, /interpretation_result_or_failure/],
    [{ neurons: -1 }, /interpretation_counts/],
  ])("given %j, when inserted, then the check refuses it", async (row, check) => {
    await expect(insert(row)).rejects.toThrow(check);
  });

  it("given text in a number column, when inserted, then STRICT refuses it", async () => {
    await expect(insert({ neurons: "nhiều" })).rejects.toThrow(/cannot store TEXT value in REAL/);
  });

  it.each(["update interpretation set outcome = 'order'", "delete from interpretation"])(
    "given a reading, when %s, then the trigger refuses",
    async (statement) => {
      const id = await insert({});

      await expect(env.DB.prepare(`${statement} where id = ?`).bind(id).run()).rejects.toThrow(
        /interpretation is append-only/,
      );
    },
  );

  it.each(["order", "reminder", "note"])(
    "given a capture read as %s, when another reading is added, then the trigger refuses it as stale",
    async (outcome) => {
      const capture = await aCapture();
      await insert({ outcome }, "019a0000-0000-7000-8000-0000000000e1", capture);

      await expect(insert({}, "019a0000-0000-7000-8000-0000000000e2", capture)).rejects.toThrow(
        /stale_version/,
      );
    },
  );

  it.each([[{ outcome: "failed", result: null, failure: "quota" }], [{ outcome: "unsure" }]])(
    "given a capture whose reading is %j, when another is added, then it is stored",
    async (row) => {
      const capture = await aCapture();
      await insert(row, "019a0000-0000-7000-8000-0000000000e1", capture);

      await expect(
        insert({}, "019a0000-0000-7000-8000-0000000000e2", capture),
      ).resolves.toBeDefined();
    },
  );
});
