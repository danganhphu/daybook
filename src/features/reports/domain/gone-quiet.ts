import type { Temporal } from "temporal-polyfill/implementation";
import type { z } from "zod";

import { err, ok, type Result } from "@/shared/domain/result";

// How many days without a live order make a customer gone quiet: worth a call. The book picks it in Settings. Plain
// code, so the settings screen shows the same bounds the server keeps.
export type QuietAfterDays = number & z.$brand<"QuietAfterDays">;

export const quietAfterDaysLimits = { min: 7, max: 180 } as const;

// Three weeks, a guess until real use says otherwise
export const defaultQuietAfterDays = 21;

function isQuietAfterDays(value: unknown): value is QuietAfterDays {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= quietAfterDaysLimits.min &&
    value <= quietAfterDaysLimits.max
  );
}

export function parseQuietAfterDays(value: unknown): Result<QuietAfterDays, string> {
  return isQuietAfterDays(value)
    ? ok(value)
    : err(`Nhập số ngày từ ${quietAfterDaysLimits.min} đến ${quietAfterDaysLimits.max}`);
}

// The latest last order a quiet customer can have
export function quietCutoff(
  today: Temporal.PlainDate,
  afterDays: QuietAfterDays,
): Temporal.PlainDate {
  return today.subtract({ days: afterDays });
}
