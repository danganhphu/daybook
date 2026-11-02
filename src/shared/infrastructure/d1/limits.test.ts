import { describe, expect, it } from "vitest";

import { productNameSchema } from "@/features/products/domain/product";
import { changeOf, recordNote, testApp, testClock, theAuthor } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { d1MaxBoundParameters } from "./limits";

// More than one statement can bind, so every read by a list of ids has to split it
const many = d1MaxBoundParameters + 20;

function anApp() {
  return testApp(testClock("2026-10-26T02:00:00Z").clock);
}

async function manyNotes() {
  const app = anApp();
  // Made once before the notes, which would otherwise race to make it
  await theAuthor();
  const notes = await Promise.all(
    Array.from({ length: many }, (_, index) => recordNote(app, `ghi chú ${index}`)),
  );

  return { app, notes };
}

describe("lists longer than D1 binds at once", () => {
  it("given a day of that many notes, when what was made of each is read, then every one is answered", async () => {
    const { app, notes } = await manyNotes();

    const states = await app.readingStates(notes.map((note) => note.captureId));

    expect(states.size).toBe(many);
  });

  it("given that many notes in the trash, when all are deleted for good, then all go", async () => {
    const { app, notes } = await manyNotes();
    const by = await theAuthor();
    const deleted = await Promise.all(
      notes.map(async (note) => expectOk(await app.deleteNote(changeOf(note, by)))),
    );

    expect(
      await app.purgeFromTrash(
        deleted.map((note) => ({ kind: "note", id: note.id, shown: note.audit.version })),
      ),
    ).toEqual({ done: many, refused: [] });
  });

  it("given that many products, when read by id, then all come", async () => {
    const app = anApp();
    const by = await theAuthor();
    const products = await Promise.all(
      Array.from({ length: many }, async (_, index) =>
        expectOk(await app.addProduct({ by, name: productNameSchema.parse(`Sản phẩm ${index}`) })),
      ),
    );

    expect(await app.getProducts(products.map((product) => product.id))).toHaveLength(many);
  });
});
