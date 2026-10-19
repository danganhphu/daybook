import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Guards the hand-edited parts of the migration: STRICT, the checks, the foreign key and the append-only triggers.
// If a regenerated migration loses any of them, one of these fails.

const captureId = "019a0000-0000-7000-8000-000000000001";

function insertCapture(id: unknown, content: unknown, source: unknown, receivedAt: unknown) {
  return env.DB.prepare(
    "insert into capture (id, content, source, received_at) values (?, ?, ?, ?)",
  )
    .bind(id, content, source, receivedAt)
    .run();
}

function insertNote(id: unknown, noteCaptureId: unknown, content: unknown) {
  return env.DB.prepare(
    "insert into note (id, capture_id, content, created_at, updated_at) values (?, ?, ?, 1, 1)",
  )
    .bind(id, noteCaptureId, content)
    .run();
}

describe("capture table", () => {
  it("given a well-formed row, when inserted, then it is stored", async () => {
    await expect(insertCapture(captureId, "ghi chú", "web", 1)).resolves.toBeDefined();
  });

  it("given an unknown source, when inserted, then the check refuses it", async () => {
    await expect(insertCapture(captureId, "ghi chú", "zalo", 1)).rejects.toThrow(
      /capture_source_known/,
    );
  });

  it("given blank content, when inserted, then the check refuses it", async () => {
    await expect(insertCapture(captureId, "   ", "web", 1)).rejects.toThrow(
      /capture_content_present/,
    );
  });

  it("given text in an integer column, when inserted, then STRICT refuses it instead of coercing", async () => {
    await expect(insertCapture(captureId, "ghi chú", "web", "yesterday")).rejects.toThrow(
      /cannot store TEXT value in INTEGER column/,
    );
  });

  it("given a null id, when inserted, then STRICT refuses it", async () => {
    await expect(insertCapture(null, "ghi chú", "web", 1)).rejects.toThrow(
      /NOT NULL constraint failed: capture\.id/,
    );
  });

  it("given a stored capture, when updated, then the trigger refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(
      env.DB.prepare("update capture set content = 'khác' where id = ?").bind(captureId).run(),
    ).rejects.toThrow(/capture is append-only/);
  });

  it("given a stored capture, when deleted, then the trigger refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(
      env.DB.prepare("delete from capture where id = ?").bind(captureId).run(),
    ).rejects.toThrow(/capture is append-only/);
  });
});

describe("note table", () => {
  it("given a capture id that does not exist, when a note is inserted, then the foreign key refuses it", async () => {
    await expect(insertNote("n1", "no-such-capture", "ghi chú")).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it("given blank content, when a note is inserted, then the check refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(insertNote("n1", captureId, " ")).rejects.toThrow(/note_content_present/);
  });

  it("given text in an integer column, when a note is inserted, then STRICT refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(
      env.DB.prepare(
        "insert into note (id, capture_id, content, created_at, updated_at) values ('n1', ?, 'x', 'today', 1)",
      )
        .bind(captureId)
        .run(),
    ).rejects.toThrow(/cannot store TEXT value in INTEGER column/);
  });
});
