import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "./account-id";
import * as Audits from "./audit";
import { versionSchema } from "./audit";

const maker = accountIdSchema.parse("019a0000-0000-7000-8000-00000000000a");
const editor = accountIdSchema.parse("019a0000-0000-7000-8000-00000000000b");
const created = Temporal.Instant.from("2026-10-23T01:00:00Z");
const later = Temporal.Instant.from("2026-10-23T02:00:00Z");

describe("Audits", () => {
  it("given a new record, when started, then its maker is also its last editor, at version 1", () => {
    expect(Audits.start(maker, created)).toEqual({
      createdAt: created,
      createdBy: maker,
      updatedAt: created,
      updatedBy: maker,
      version: 1,
    });
  });

  it("given a change by someone else, when recorded, then the creation stays and the version moves by one", () => {
    const changed = Audits.change(Audits.start(maker, created), editor, later);

    expect(changed).toEqual({
      createdAt: created,
      createdBy: maker,
      updatedAt: later,
      updatedBy: editor,
      version: 2,
    });
  });

  it("given the version a screen showed, when checked, then only the stored version is current", () => {
    const audit = Audits.change(Audits.start(maker, created), editor, later);

    expect(Audits.isCurrent(audit, versionSchema.parse(2))).toBe(true);
    expect(Audits.isCurrent(audit, versionSchema.parse(1))).toBe(false);
  });

  it("given a deletion, when recorded, then it says who and when", () => {
    expect(Audits.deletion(editor, later)).toEqual({ deletedAt: later, deletedBy: editor });
  });

  it.each([0, -1, 1.5, Number.NaN, "1"])(
    "given %s, when read as a version, then it is refused",
    (value) => {
      expect(versionSchema.safeParse(value).success).toBe(false);
    },
  );
});
