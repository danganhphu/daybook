import type { z } from "zod";

import { err, ok, type Result } from "@/shared/domain/result";

// When a notification goes out, "07:30", in Vietnam. On the quarter hour, because that is how often the scheduler runs
// (cloudflare.config.ts). Plain code, so the settings screen offers the same times the server accepts.
export type TimeOfDay = string & z.$brand<"TimeOfDay">;

export const minutesPerSlot = 15;

const hoursPerDay = 24;
const minutesPerHour = 60;

function format(minutes: number): string {
  const hours = Math.floor(minutes / minutesPerHour);

  return `${String(hours).padStart(2, "0")}:${String(minutes % minutesPerHour).padStart(2, "0")}`;
}

// Every time that can be picked, from 00:00 to 23:45
export const timesOfDay: ReadonlyArray<string> = Array.from(
  { length: (hoursPerDay * minutesPerHour) / minutesPerSlot },
  (_, slot) => format(slot * minutesPerSlot),
);

const known = new Set(timesOfDay);

function isTimeOfDay(text: string): text is TimeOfDay {
  return known.has(text);
}

export function parseTimeOfDay(text: unknown): Result<TimeOfDay, string> {
  return typeof text === "string" && isTimeOfDay(text)
    ? ok(text)
    : err("Giờ phải tròn 15 phút, như 07:30");
}

// Placeholders nobody has checked with her (known-gaps): each person changes them in Settings
export const defaultTimes = { morning: "07:30", weekly: "17:00" } as const;

// The slot a moment falls in: minutes since midnight, rounded down to the quarter hour
export function slotTime(hour: number, minute: number): string {
  return format(hour * minutesPerHour + minute - (minute % minutesPerSlot));
}
