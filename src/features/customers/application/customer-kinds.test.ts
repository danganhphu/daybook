import { describe, expect, it } from "vitest";

import { kindNameSchema } from "@/features/customers/domain/customer-kind";
import { changeOf, testApp, testClock, theAuthor, thePartner } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

function name(text: string) {
  return kindNameSchema.parse(text);
}

function anApp() {
  return testApp(testClock("2026-10-23T01:00:00Z").clock);
}

describe("customer kinds", () => {
  it("given kinds added one after another, when listed, then they come in the order they were added", async () => {
    const app = anApp();
    const by = await theAuthor();
    for (const kind of ["Nha khoa", "Đại lý", "Công ty"]) {
      // oxlint-disable-next-line no-await-in-loop -- each goes after the one before
      expectOk(await app.addCustomerKind({ by, name: name(kind) }));
    }

    const kinds = await app.listCustomerKinds();

    expect(kinds.map((kind) => [kind.name, kind.position])).toEqual([
      ["Nha khoa", 0],
      ["Đại lý", 1],
      ["Công ty", 2],
    ]);
  });

  it("given a kind, when one with the same name in another case or without accents is added, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    expectOk(await app.addCustomerKind({ by, name: name("Đại lý") }));

    expect(await app.addCustomerKind({ by, name: name("dai LY") })).toEqual({
      ok: false,
      error: "kind_name_taken",
    });
  });

  it("given a kind, when the other person renames it, then the name and editor change", async () => {
    const app = anApp();
    const kind = expectOk(
      await app.addCustomerKind({ by: await theAuthor(), name: name("Đai ly") }),
    );
    const partner = await thePartner();

    const renamed = expectOk(
      await app.renameCustomerKind({ ...changeOf(kind, partner), name: name("Đại lý") }),
    );

    expect(renamed.name).toBe("Đại lý");
    expect(renamed.audit.updatedBy).toBe(partner);
    expect(renamed.audit.version).toBe(2);
  });

  it("given a kind, when renamed to its own name in other letters, then it is allowed; to another kind's name, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const clinic = expectOk(await app.addCustomerKind({ by, name: name("nha khoa") }));
    expectOk(await app.addCustomerKind({ by, name: name("Đại lý") }));

    const fixed = expectOk(
      await app.renameCustomerKind({ ...changeOf(clinic, by), name: name("Nha khoa") }),
    );

    expect(await app.renameCustomerKind({ ...changeOf(fixed, by), name: name("đại lý") })).toEqual({
      ok: false,
      error: "kind_name_taken",
    });
  });

  it("given a kind renamed on another device, when renamed from the old screen, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const shown = expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));
    expectOk(
      await app.renameCustomerKind({ ...changeOf(shown, await thePartner()), name: name("Tiệm") }),
    );

    expect(await app.renameCustomerKind({ ...changeOf(shown, by), name: name("Shop") })).toEqual({
      ok: false,
      error: "kind_changed_elsewhere",
    });
  });

  it("given an archived kind, when listed, then it comes after the active ones; its name is free for a new kind", async () => {
    const app = anApp();
    const by = await theAuthor();
    const old = expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));
    expectOk(await app.addCustomerKind({ by, name: name("Đại lý") }));
    expectOk(await app.archiveCustomerKind(changeOf(old, by)));

    expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));
    const kinds = await app.listCustomerKinds();

    expect(kinds.map((kind) => [kind.name, kind.status])).toEqual([
      ["Đại lý", "active"],
      ["Nha khoa", "active"],
      ["Nha khoa", "archived"],
    ]);
  });

  it("given an archived kind whose name was taken meanwhile, when restored, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const old = expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));
    const archived = expectOk(await app.archiveCustomerKind(changeOf(old, by)));
    expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));

    expect(await app.restoreCustomerKind(changeOf(archived, by))).toEqual({
      ok: false,
      error: "kind_name_taken",
    });
  });

  it("given an archived kind, when restored, then it is active again", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kind = expectOk(await app.addCustomerKind({ by, name: name("Nha khoa") }));
    const archived = expectOk(await app.archiveCustomerKind(changeOf(kind, by)));

    const restored = expectOk(await app.restoreCustomerKind(changeOf(archived, by)));

    expect(restored.status).toBe("active");
    expect(await app.archiveCustomerKind(changeOf(archived, by))).toEqual({
      ok: false,
      error: "kind_changed_elsewhere",
    });
  });
});
