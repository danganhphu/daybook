import { describe, expect, it } from "vitest";

import { nextDay } from "./next-day";

describe("nextDay", () => {
  it.each([
    ["2026-10-23", "2026-10-24"],
    ["2026-10-31", "2026-11-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
  ])("given %s, when the next day is asked, then it is %s", (day, next) => {
    expect(nextDay(day)).toBe(next);
  });
});
