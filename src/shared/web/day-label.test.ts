import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { dayHeading, dayLabel } from "./day-label";

const today = Temporal.PlainDate.from("2026-10-23"); // a Friday

function day(text: string) {
  return Temporal.PlainDate.from(text);
}

describe("dayLabel", () => {
  it.each([
    ["2026-10-19", "Thứ Hai, 19/10"],
    ["2026-10-25", "Chủ Nhật, 25/10"],
    ["2026-10-05", "Thứ Hai, 5/10"],
    // Another year says which
    ["2025-12-31", "Thứ Tư, 31/12/2025"],
  ])("given %s, when labelled, then it reads %j", (date, expected) => {
    expect(dayLabel(day(date), today)).toBe(expected);
  });
});

describe("dayHeading", () => {
  it.each([
    ["2026-10-23", { title: "Hôm nay", subtitle: "Thứ Sáu, 23/10" }],
    ["2026-10-22", { title: "Hôm qua", subtitle: "Thứ Năm, 22/10" }],
    ["2026-10-20", { title: "Thứ Ba, 20/10", subtitle: "3 ngày trước" }],
    ["2025-10-23", { title: "Thứ Năm, 23/10/2025", subtitle: "365 ngày trước" }],
  ])("given %s, when headed, then it reads %j", (date, expected) => {
    expect(dayHeading(day(date), today)).toEqual(expected);
  });
});
