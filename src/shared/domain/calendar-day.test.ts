import { describe, expect, it } from "vitest";

import { calendarDaySchema } from "./calendar-day";

describe("calendarDaySchema", () => {
  it("given a day written as YYYY-MM-DD, when parsed, then it is that calendar day", () => {
    expect(calendarDaySchema.parse("2026-10-21").toString()).toBe("2026-10-21");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-5", "21/10/2026", "2026-10-21T00:00", "", 20261021])(
    "given %j, when parsed, then it is refused rather than rounded to a nearby day",
    (value) => {
      expect(calendarDaySchema.safeParse(value).success).toBe(false);
    },
  );
});
