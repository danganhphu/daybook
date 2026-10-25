import type { Temporal } from "temporal-polyfill/implementation";

// A customer with no live order for this many days has gone quiet: worth a call
export const quietAfterDays = 21;

// The latest last order a quiet customer can have
export function quietCutoff(today: Temporal.PlainDate): Temporal.PlainDate {
  return today.subtract({ days: quietAfterDays });
}
