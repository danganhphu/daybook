import { vietnamOffsetMilliseconds } from "@/shared/domain/vietnam-time-zone";

// Times and days as people here write them: "09:12", "24/10". By hand on Vietnam's fixed offset: the Worker's ICU
// writes vi-VN's day and month as "24-10", an Intl formatter cost the Worker its time zone data on every cold start, and
// plain arithmetic lets the browser use it without Temporal.

const minutesPerDay = 24 * 60;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

// "09:12"
export function clockText(hour: number, minute: number): string {
  return `${twoDigits(hour)}:${twoDigits(minute)}`;
}

// "24/10", "2/9": the day and month as numbers, as a date inside a sentence reads
export function dayMonthText(day: number, month: number): string {
  return `${day}/${month}`;
}

// "09:12" for a moment, on Vietnam's clock
export function clockTime(epochMilliseconds: number): string {
  const minutes = Math.floor((epochMilliseconds + vietnamOffsetMilliseconds) / 60_000);
  const ofDay = ((minutes % minutesPerDay) + minutesPerDay) % minutesPerDay;

  return clockText(Math.floor(ofDay / 60), ofDay % 60);
}

// "16:02 22/10" for a moment - a Temporal.Instant, say - in Vietnam: when something happened to an account or a device
export function momentText({ epochMilliseconds }: { readonly epochMilliseconds: number }): string {
  const local = new Date(epochMilliseconds + vietnamOffsetMilliseconds);

  return `${clockTime(epochMilliseconds)} ${dayMonthText(local.getUTCDate(), local.getUTCMonth() + 1)}`;
}
