import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as Captures from "@/features/capture/domain/capture";
import * as Notes from "@/features/notes/domain/note";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { content } from "@/testing/support/app";

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
    const capture = Captures.receive(content("gel tê"), "web", received);
    const work = createUnitOfWork(createDatabase(env.DB));
    work.captures.add(capture);
    work.notes.add(Notes.fromCapture(capture));

    await work.commit();

    expect(await countRows("capture")).toBe(1);
    expect(await countRows("note")).toBe(1);
  });

  it("given a write from one feature that fails after a write from another succeeds, when committed, then neither is stored", async () => {
    const capture = Captures.receive(content("gel tê"), "web", received);
    // A note pointing at a capture that was never added: the foreign key fails the second statement
    const orphan = Notes.fromCapture(Captures.receive(content("lạc"), "web", received));
    const work = createUnitOfWork(createDatabase(env.DB));
    work.captures.add(capture);
    work.notes.add(orphan);

    // What matters is that nothing was stored, not how the driver words the failure
    await expect(work.commit()).rejects.toBeInstanceOf(Error);
    expect(await countRows("capture")).toBe(0);
    expect(await countRows("note")).toBe(0);
  });

  it("given nothing queued, when committed, then it does nothing", async () => {
    await expect(createUnitOfWork(createDatabase(env.DB)).commit()).resolves.toBeUndefined();
  });
});
