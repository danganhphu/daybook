import type { Temporal } from "temporal-polyfill/implementation";

// Monday first, as Temporal numbers them (dayOfWeek 1 to 7). Written out rather than asked of Intl: the Worker's ICU
// and a browser's do not always agree on Vietnamese dates.
const weekdays = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
] as const;

// "Thứ Hai" for a Monday, "Chủ Nhật" for a Sunday
export function weekdayName(day: Temporal.PlainDate): string {
  return weekdays[day.dayOfWeek - 1] ?? "";
}
