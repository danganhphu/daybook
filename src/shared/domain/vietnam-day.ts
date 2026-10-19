import { Temporal } from "temporal-polyfill/implementation";

// Her day is a Vietnamese calendar day. Going through the zone, not a fixed +07:00, keeps that from being an assumption.
export const vietnamTimeZone = "Asia/Ho_Chi_Minh";

export type DayBounds = {
  readonly start: Temporal.Instant;
  readonly end: Temporal.Instant;
};

export function vietnamDate(instant: Temporal.Instant): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(vietnamTimeZone).toPlainDate();
}

// Half-open: start is inside the day, end is the first instant of the next one
export function vietnamDayBounds(date: Temporal.PlainDate): DayBounds {
  return {
    start: date.toZonedDateTime(vietnamTimeZone).toInstant(),
    end: date.add({ days: 1 }).toZonedDateTime(vietnamTimeZone).toInstant(),
  };
}
