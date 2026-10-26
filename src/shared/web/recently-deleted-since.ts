import type { Temporal } from "temporal-polyfill/implementation";

import { vietnamDate } from "@/shared/domain/vietnam-day";

import { recentlyDeleted } from "./recently-deleted";

// The server side of "Đã xoá gần đây": where its window starts, and how a row says when it went

export function recentlyDeletedSince(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: recentlyDeleted.days * 24 });
}

export function deletedText(at: Temporal.Instant, by: string): string {
  const day = vietnamDate(at);

  return `Xoá ${day.day}/${day.month} (${by})`;
}
