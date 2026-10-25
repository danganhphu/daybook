import { describe, expect, it } from "vitest";

import { axisTop, labelStride, shareOf } from "./chart-scale";

describe("axisTop", () => {
  it.each([
    [0, 0],
    [800_000, 1_000_000],
    [1_000_000, 1_000_000],
    [1_380_000, 2_000_000],
    [3_325_000, 4_000_000],
    [4_200_000, 5_000_000],
    [6_000_000, 10_000_000],
    [999, 1_000],
  ])("given a largest value of %d, when the axis is topped, then it ends at %d", (largest, top) => {
    expect(axisTop(largest)).toBe(top);
  });
});

describe("shareOf", () => {
  it("given values against a top, when shared, then they are whole percents and nothing above zero vanishes", () => {
    expect([0, 1, 400_000, 1_000_000].map((value) => shareOf(value, 1_000_000))).toEqual([
      0, 1, 40, 100,
    ]);
    expect(shareOf(5, 0)).toBe(0);
  });
});

describe("labelStride", () => {
  it("given 7, 12, 14 and 31 columns, when labelled, then every 1st, 2nd, 2nd and 5th has one", () => {
    expect([7, 12, 14, 31].map(labelStride)).toEqual([1, 2, 2, 5]);
  });
});
