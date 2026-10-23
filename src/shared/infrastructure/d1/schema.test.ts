import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

// Guards the hand-edited parts of the migration: STRICT, the checks, the foreign key and the append-only triggers.
// If a regenerated migration loses any of them, one of these fails.

const captureId = "019a0000-0000-7000-8000-000000000001";
const authorId = "019a0000-0000-7000-8000-0000000000a1";

// Every capture names its author, so each test starts with one account
beforeEach(async () => {
  await env.DB.prepare(
    "insert into account (id, username, display_name, webauthn_user_handle, created_at, updated_at) values (?, 'author', 'Người ghi', ?, 1, 1)",
  )
    .bind(authorId, "H".repeat(43))
    .run();
});

function insertCapture(
  id: unknown,
  content: unknown,
  source: unknown,
  receivedAt: unknown,
  author: unknown = authorId,
) {
  return env.DB.prepare(
    "insert into capture (id, content, source, author_id, received_at) values (?, ?, ?, ?, ?)",
  )
    .bind(id, content, source, author, receivedAt)
    .run();
}

const noteId = "019a0000-0000-7000-8000-000000000002";

type NoteRow = {
  readonly id: unknown;
  readonly captureId: unknown;
  readonly content: unknown;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly version: unknown;
  readonly deletedAt: unknown;
  readonly deletedBy: unknown;
};

const aNote: NoteRow = {
  id: noteId,
  captureId,
  content: "ghi chú",
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  deletedAt: null,
  deletedBy: null,
};

function insertNote(changes: Partial<NoteRow> = {}) {
  const note = { ...aNote, ...changes };

  return env.DB.prepare(
    "insert into note (id, capture_id, content, search_text, created_at, created_by, updated_at, updated_by, version, deleted_at, deleted_by) values (?, ?, ?, 'ghi chu', ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      note.id,
      note.captureId,
      note.content,
      note.createdAt,
      authorId,
      note.updatedAt,
      authorId,
      note.version,
      note.deletedAt,
      note.deletedBy,
    )
    .run();
}

async function insertCaptureAndNote() {
  await insertCapture(captureId, "ghi chú", "web", 1);
  await insertNote();
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

  it("given an author with no account, when inserted, then the foreign key refuses it", async () => {
    await expect(
      insertCapture(captureId, "ghi chú", "web", 1, "019a0000-0000-7000-8000-0000000000ff"),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it("given no author, when inserted, then the table refuses it", async () => {
    await expect(insertCapture(captureId, "ghi chú", "web", 1, null)).rejects.toThrow(
      /NOT NULL constraint failed: capture\.author_id/,
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
  it("given a well-formed row, when inserted, then it is stored", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(insertNote()).resolves.toBeDefined();
  });

  it("given a capture id that does not exist, when a note is inserted, then the foreign key refuses it", async () => {
    await expect(insertNote({ captureId: "no-such-capture" })).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it("given blank content, when a note is inserted, then the check refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(insertNote({ content: " " })).rejects.toThrow(/note_content_present/);
  });

  it("given text in an integer column, when a note is inserted, then STRICT refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(insertNote({ createdAt: "today" })).rejects.toThrow(
      /cannot store TEXT value in INTEGER column/,
    );
  });

  it("given version 0, when a note is inserted, then the check refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 1);

    await expect(insertNote({ version: 0 })).rejects.toThrow(/note_version_positive/);
  });

  it("given a change dated before the creation, when a note is inserted, then the check refuses it", async () => {
    await insertCapture(captureId, "ghi chú", "web", 2);

    await expect(insertNote({ createdAt: 2, updatedAt: 1 })).rejects.toThrow(
      /note_updated_after_created/,
    );
  });

  it.each([
    { deletedAt: 2, deletedBy: null },
    { deletedAt: null, deletedBy: authorId },
  ])(
    "given half a deletion ($deletedAt, $deletedBy), when a note is inserted, then the check refuses it",
    async (deletion) => {
      await insertCapture(captureId, "ghi chú", "web", 1);

      await expect(insertNote(deletion)).rejects.toThrow(/note_deletion_whole/);
    },
  );

  it.each([1, 3])(
    "given a stored note at version 1, when updated to version %s, then the trigger refuses it as stale",
    async (version) => {
      await insertCaptureAndNote();

      await expect(
        env.DB.prepare("update note set content = 'khác', version = ? where id = ?")
          .bind(version, noteId)
          .run(),
      ).rejects.toThrow(/stale_version/);
    },
  );

  it("given a stored note, when updated to the next version, then it is stored", async () => {
    await insertCaptureAndNote();

    await env.DB.prepare("update note set content = 'khác', version = 2 where id = ?")
      .bind(noteId)
      .run();

    expect(
      await env.DB.prepare("select content, version from note where id = ?").bind(noteId).first(),
    ).toEqual({ content: "khác", version: 2 });
  });

  it.each(["created_at = 5", "created_by = 'someone-else'"])(
    "given a stored note, when its creation is rewritten (%s), then the trigger refuses it",
    async (rewrite) => {
      await insertCaptureAndNote();

      await expect(
        env.DB.prepare(`update note set ${rewrite}, version = 2 where id = ?`).bind(noteId).run(),
      ).rejects.toThrow(/creation_is_fixed/);
    },
  );
});
