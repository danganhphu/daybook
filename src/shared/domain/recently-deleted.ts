import type { Temporal } from "temporal-polyfill/implementation";

// How long a deleted thing stays in "Đã xoá gần đây" to be restored; after that it leaves the database for good
export const recentlyDeletedDays = 30;

export function recentlyDeletedSince(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: recentlyDeletedDays * 24 });
}
