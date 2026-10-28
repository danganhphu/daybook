import type { Temporal } from "temporal-polyfill/implementation";

import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";

import { slotTime } from "./time-of-day";

// A quarter hour of a Vietnamese day: what the scheduler decides who is due in
export type Slot = {
  readonly day: Temporal.PlainDate;
  readonly time: string;
};

// The slot a scheduled run was meant for. Its scheduled time, not the clock, so a run that starts late still serves its
// own slot rather than skipping it.
export function slotAt(scheduledTime: Temporal.Instant): Slot {
  const local = scheduledTime.toZonedDateTimeISO(vietnamTimeZone);

  return { day: local.toPlainDate(), time: slotTime(local.hour, local.minute) };
}
