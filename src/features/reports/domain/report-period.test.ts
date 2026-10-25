import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { expectOk } from "@/testing/support/result";

import {
  bucketFor,
  bucketKey,
  bucketsOf,
  nextPeriod,
  periodContaining,
  previousPeriod,
  rangeOf,
  type ReportPeriod,
} from "./report-period";

const day = (text: string) => Temporal.PlainDate.from(text);

function days(period: ReportPeriod) {
  return [period.from.toString(), period.to.toString()];
}

describe("calendar periods", () => {
  it("given a Sunday, when its week is taken, then it runs from the Monday before to that Sunday", () => {
    expect(days(periodContaining("week", day("2026-10-25")))).toEqual(["2026-10-19", "2026-10-25"]);
    expect(days(periodContaining("week", day("2026-10-19")))).toEqual(["2026-10-19", "2026-10-25"]);
  });

  it("given a week across the new year, when taken, then it keeps its seven days in both years", () => {
    expect(days(periodContaining("week", day("2027-01-01")))).toEqual(["2026-12-28", "2027-01-03"]);
  });

  it("given days in a month, a quarter and a year, when their periods are taken, then each runs first to last day", () => {
    expect(days(periodContaining("month", day("2028-02-14")))).toEqual([
      "2028-02-01",
      "2028-02-29",
    ]);
    expect(days(periodContaining("quarter", day("2026-10-25")))).toEqual([
      "2026-10-01",
      "2026-12-31",
    ]);
    expect(days(periodContaining("quarter", day("2026-03-31")))).toEqual([
      "2026-01-01",
      "2026-03-31",
    ]);
    expect(days(periodContaining("year", day("2026-10-25")))).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("given a period, when moved back and forward, then each step is one whole period of the same kind", () => {
    const march = periodContaining("month", day("2026-03-10"));

    expect(days(previousPeriod(march))).toEqual(["2026-02-01", "2026-02-28"]);
    expect(days(nextPeriod(march))).toEqual(["2026-04-01", "2026-04-30"]);
    expect(days(previousPeriod(periodContaining("quarter", day("2026-02-01"))))).toEqual([
      "2025-10-01",
      "2025-12-31",
    ]);
    expect(nextPeriod(march).kind).toBe("month");
  });
});

describe("ranges", () => {
  it("given a range, when moved back and forward, then it keeps its length next to itself", () => {
    const range = expectOk(rangeOf(day("2026-10-10"), day("2026-10-19")));

    expect(days(previousPeriod(range))).toEqual(["2026-09-30", "2026-10-09"]);
    expect(days(nextPeriod(range))).toEqual(["2026-10-20", "2026-10-29"]);
  });

  it("given a range backwards or longer than two years, when made, then it is refused; one day is a range", () => {
    expect(rangeOf(day("2026-10-20"), day("2026-10-19"))).toEqual({
      ok: false,
      error: "range_reversed",
    });
    expect(rangeOf(day("2024-01-01"), day("2026-01-01"))).toEqual({
      ok: false,
      error: "range_too_long",
    });
    expect(rangeOf(day("2024-01-01"), day("2025-12-31")).ok).toBe(true);
    expect(rangeOf(day("2026-10-20"), day("2026-10-20")).ok).toBe(true);
  });
});

describe("buckets", () => {
  it("given each kind of period, when bucketed, then weeks and months go by day, quarters by week, years by month", () => {
    const on = day("2026-10-25");

    expect(bucketFor(periodContaining("week", on))).toBe("day");
    expect(bucketFor(periodContaining("month", on))).toBe("day");
    expect(bucketFor(periodContaining("quarter", on))).toBe("week");
    expect(bucketFor(periodContaining("year", on))).toBe("month");
  });

  it("given ranges of 31, 32, 92 and 93 days, when bucketed, then they go by day, week, week and month", () => {
    const from = day("2026-01-01");
    const range = (length: number) => expectOk(rangeOf(from, from.add({ days: length - 1 })));

    expect([31, 32, 92, 93].map((length) => bucketFor(range(length)))).toEqual([
      "day",
      "week",
      "week",
      "month",
    ]);
  });

  it("given a quarter, when its weeks are listed, then they start on Mondays from the one holding its first day", () => {
    const quarter = periodContaining("quarter", day("2026-10-25"));

    const weeks = bucketsOf(quarter, "week").map((start) => bucketKey(start, "week"));

    expect(weeks[0]).toBe("2026-09-28");
    expect(weeks.at(-1)).toBe("2026-12-28");
    expect(weeks).toHaveLength(14);
  });

  it("given a year and a month, when bucketed, then there is a column for every month and every day", () => {
    expect(
      bucketsOf(periodContaining("year", day("2026-10-25")), "month").map((start) =>
        bucketKey(start, "month"),
      ),
    ).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(bucketsOf(periodContaining("month", day("2026-02-10")), "day")).toHaveLength(28);
  });
});
