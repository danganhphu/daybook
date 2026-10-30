import type { Temporal } from "temporal-polyfill/implementation";

import { vietnamDate } from "@/shared/domain/vietnam-day";

// The server side of "Đã xoá gần đây": how a row says when it went
export function deletedText(at: Temporal.Instant, by: string): string {
  const day = vietnamDate(at);

  return `Xoá ${day.day}/${day.month} (${by})`;
}
