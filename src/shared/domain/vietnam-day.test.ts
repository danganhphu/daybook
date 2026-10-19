import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { vietnamDate, vietnamDayBounds } from "./vietnam-day";

describe("vietnamDate", () => {
  it("given the last millisecond before midnight in Vietnam, when dated, then it belongs to the earlier day", () => {
    const instant = Temporal.Instant.from("2026-10-15T16:59:59.999Z");

    expect(vietnamDate(instant).toString()).toBe("2026-10-15");
  });

  it("given midnight in Vietnam, still the previous day in UTC, when dated, then it belongs to the new day", () => {
    const instant = Temporal.Instant.from("2026-10-15T17:00:00Z");

    expect(vietnamDate(instant).toString()).toBe("2026-10-16");
  });
});

describe("vietnamDayBounds", () => {
  it("given a date, when bounded, then it spans midnight to the next midnight in Vietnam", () => {
    const { start, end } = vietnamDayBounds(Temporal.PlainDate.from("2026-10-16"));

    expect(start.toString()).toBe("2026-10-15T17:00:00Z");
    expect(end.toString()).toBe("2026-10-16T17:00:00Z");
  });
});
