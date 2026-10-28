import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { expectOk } from "@/testing/support/result";

import { parseQuietAfterDays, quietCutoff } from "./gone-quiet";

describe("parseQuietAfterDays", () => {
  it.each([7, 21, 180])("given %i days, when parsed, then they are taken", (days) => {
    expect(parseQuietAfterDays(days)).toEqual({ ok: true, value: days });
  });

  it.each([6, 181, 7.5, "21", Number.NaN, undefined])(
    "given %s, when parsed, then it is refused with the bounds",
    (value) => {
      expect(parseQuietAfterDays(value)).toEqual({
        ok: false,
        error: "Nhập số ngày từ 7 đến 180",
      });
    },
  );
});

describe("quietCutoff", () => {
  it("given 30 days, when worked out, then a last order on the day 30 days back is the latest still quiet", () => {
    const cutoff = quietCutoff(
      Temporal.PlainDate.from("2026-10-29"),
      expectOk(parseQuietAfterDays(30)),
    );

    expect(cutoff.toString()).toBe("2026-09-29");
  });
});
