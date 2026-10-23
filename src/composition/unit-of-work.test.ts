import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as Captures from "@/features/capture/domain/capture";
import * as Notes from "@/features/notes/domain/note";
import { StaleWriteError } from "@/shared/application/stale-write";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { content, theAuthor } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { createUnitOfWork } from "./unit-of-work";

const received = Temporal.Instant.from("2026-10-16T01:00:00Z");

async function countRows(table: "capture" | "note") {
  const row = await env.DB.prepare(`select count(*) as count from ${table}`).first<{
    count: number;
  }>();

  return row?.count;
}

describe("createUnitOfWork", () => {
  it("given a capture and its note, when committed, then both are stored", async () => {
    const capture = Captures.receive(content("thuốc tê"), "web", await theAuthor(), received);
    const work = createUnitOfWork(createDatabase(env.DB));
    work.captures.add(capture);
    work.notes.add(Notes.fromCapture(capture));

    await work.commit();

    expect(await countRows("capture")).toBe(1);
    expect(await countRows("note")).toBe(1);
  });

  it("given a write from one feature that fails after a write from another succeeds, when committed, then neither is stored", async () => {
    const capture = Captures.receive(content("thuốc tê"), "web", await theAuthor(), received);
    // A note pointing at a capture that was never added: the foreign key fails the second statement
    const orphan = Notes.fromCapture(
      Captures.receive(content("lạc"), "web", await theAuthor(), received),
    );
    const work = createUnitOfWork(createDatabase(env.DB));
    work.captures.add(capture);
    work.notes.add(orphan);

    // What matters is that nothing was stored, not how the driver words the failure
    await expect(work.commit()).rejects.toBeInstanceOf(Error);
    expect(await countRows("capture")).toBe(0);
    expect(await countRows("note")).toBe(0);
  });

  it("given two changes made from the same version, when both are committed, then the second is a stale write and is not stored", async () => {
    const author = await theAuthor();
    const capture = Captures.receive(content("thuốc tê x2"), "web", author, received);
    const note = Notes.fromCapture(capture);
    const db = createDatabase(env.DB);
    const setup = createUnitOfWork(db);
    setup.captures.add(capture);
    setup.notes.add(note);
    await setup.commit();
    const first = createUnitOfWork(db);
    first.notes.update(expectOk(Notes.edit(note, content("thuốc tê x3"), author, received)));
    await first.commit();

    // Both edits passed the application's version check before either was written
    const second = createUnitOfWork(db);
    second.notes.update(expectOk(Notes.edit(note, content("thuốc tê x5"), author, received)));

    await expect(second.commit()).rejects.toBeInstanceOf(StaleWriteError);
    expect(
      await env.DB.prepare("select content from note where id = ?").bind(note.id).first(),
    ).toEqual({ content: "thuốc tê x3" });
  });

  it("given nothing queued, when committed, then it does nothing", async () => {
    await expect(createUnitOfWork(createDatabase(env.DB)).commit()).resolves.toBeUndefined();
  });
});
