import { Temporal } from "temporal-polyfill/implementation";

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

const shortWeekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

// "T2" for a Monday, "CN" for a Sunday, as a calendar's column heads write them
export function shortWeekday(day: Temporal.PlainDate): string {
  return shortWeekdays[day.dayOfWeek - 1] ?? "";
}

// "Thứ Hai, 19/10", with the year only when it is not this one: "Thứ Tư, 31/12/2025"
export function dayLabel(day: Temporal.PlainDate, today: Temporal.PlainDate): string {
  const date = `${day.day}/${day.month}`;

  return `${weekdays[day.dayOfWeek - 1]}, ${day.year === today.year ? date : `${date}/${day.year}`}`;
}

export type DayHeading = {
  // Large: "Hôm nay", "Hôm qua", or the date
  readonly title: string;
  // Small, above it: the date, or how long ago
  readonly subtitle: string;
};

export function dayHeading(day: Temporal.PlainDate, today: Temporal.PlainDate): DayHeading {
  const label = dayLabel(day, today);
  const daysAgo = day.until(today, { largestUnit: "days" }).days;

  if (daysAgo === 0) {
    return { title: "Hôm nay", subtitle: label };
  }
  if (daysAgo === 1) {
    return { title: "Hôm qua", subtitle: label };
  }

  return { title: label, subtitle: `${daysAgo} ngày trước` };
}
