import { Temporal } from "temporal-polyfill/implementation";

import { err, ok, type Result } from "@/shared/domain/result";

// The days a report covers, both ends included. A calendar period - a week from Monday, a month, a quarter, a year -
// moves by whole periods; a range of days moves by its own length.
export const periodKinds = ["week", "month", "quarter", "year", "range"] as const;

export type PeriodKind = (typeof periodKinds)[number];

export type CalendarPeriodKind = Exclude<PeriodKind, "range">;

export type ReportPeriod = {
  readonly kind: PeriodKind;
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
};

// What one column of a chart over time holds: a day, a week from Monday, or a month
export const bucketKinds = ["day", "week", "month"] as const;

export type BucketKind = (typeof bucketKinds)[number];

export const periodLimits = {
  // Two years, so a range still fits a chart of months
  rangeDays: 731,
  // A range is shown by day up to this many days, then by week up to the next
  dailyDays: 31,
  weeklyDays: 92,
} as const;

export type PeriodError = "range_reversed" | "range_too_long";

const monthsInQuarter = 3;

export function periodContaining(kind: CalendarPeriodKind, day: Temporal.PlainDate): ReportPeriod {
  switch (kind) {
    case "week": {
      const from = day.subtract({ days: day.dayOfWeek - 1 });
      return { kind, from, to: from.add({ days: 6 }) };
    }
    case "month": {
      const from = day.with({ day: 1 });
      return { kind, from, to: from.with({ day: from.daysInMonth }) };
    }
    case "quarter": {
      const firstMonth = Math.floor((day.month - 1) / monthsInQuarter) * monthsInQuarter + 1;
      const from = day.with({ month: firstMonth, day: 1 });
      const lastMonth = from.add({ months: monthsInQuarter - 1 });
      return { kind, from, to: lastMonth.with({ day: lastMonth.daysInMonth }) };
    }
    case "year":
      return { kind, from: day.with({ month: 1, day: 1 }), to: day.with({ month: 12, day: 31 }) };
    default:
      return kind satisfies never;
  }
}

export function lengthInDays(period: ReportPeriod): number {
  return period.from.until(period.to, { largestUnit: "days" }).days + 1;
}

export function rangeOf(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): Result<ReportPeriod, PeriodError> {
  const range = { kind: "range" as const, from, to };
  if (Temporal.PlainDate.compare(from, to) > 0) {
    return err("range_reversed");
  }
  if (lengthInDays(range) > periodLimits.rangeDays) {
    return err("range_too_long");
  }

  return ok(range);
}

export function previousPeriod(period: ReportPeriod): ReportPeriod {
  if (period.kind === "range") {
    const days = lengthInDays(period);
    return {
      kind: "range",
      from: period.from.subtract({ days }),
      to: period.from.subtract({ days: 1 }),
    };
  }

  return periodContaining(period.kind, period.from.subtract({ days: 1 }));
}

export function nextPeriod(period: ReportPeriod): ReportPeriod {
  if (period.kind === "range") {
    const days = lengthInDays(period);
    return { kind: "range", from: period.to.add({ days: 1 }), to: period.to.add({ days }) };
  }

  return periodContaining(period.kind, period.to.add({ days: 1 }));
}

export function bucketFor(period: ReportPeriod): BucketKind {
  switch (period.kind) {
    case "week":
    case "month":
      return "day";
    case "quarter":
      return "week";
    case "year":
      return "month";
    case "range": {
      const days = lengthInDays(period);
      if (days <= periodLimits.dailyDays) {
        return "day";
      }
      return days <= periodLimits.weeklyDays ? "week" : "month";
    }
    default:
      return period.kind satisfies never;
  }
}

// The first day of the bucket a day falls in
export function bucketStart(day: Temporal.PlainDate, bucket: BucketKind): Temporal.PlainDate {
  switch (bucket) {
    case "day":
      return day;
    case "week":
      return day.subtract({ days: day.dayOfWeek - 1 });
    case "month":
      return day.with({ day: 1 });
    default:
      return bucket satisfies never;
  }
}

// How a bucket is named where sales are summed by it: its first day, or YYYY-MM for a month
export function bucketKey(start: Temporal.PlainDate, bucket: BucketKind): string {
  return bucket === "month" ? start.toPlainYearMonth().toString() : start.toString();
}

// Every bucket the period touches, in order, so a chart has a column for a day with no sales too
export function bucketsOf(
  period: ReportPeriod,
  bucket: BucketKind,
): ReadonlyArray<Temporal.PlainDate> {
  const step = { day: { days: 1 }, week: { weeks: 1 }, month: { months: 1 } }[bucket];
  const starts: Temporal.PlainDate[] = [];
  for (
    let start = bucketStart(period.from, bucket);
    Temporal.PlainDate.compare(start, period.to) <= 0;
    start = start.add(step)
  ) {
    starts.push(start);
  }

  return starts;
}
