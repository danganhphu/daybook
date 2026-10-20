import { Temporal } from "temporal-polyfill/implementation";

import { vietnamTimeZone } from "./vietnam-time-zone";

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
