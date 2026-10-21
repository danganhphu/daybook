import type { Temporal } from "temporal-polyfill/implementation";

// Counts attempts per key in fixed windows and answers how many this one makes, itself included. The count is
// stored and returned in one step, so two requests at once cannot both see the old number.
export type RateLimiter = {
  hit(key: string, window: Temporal.Duration, now: Temporal.Instant): Promise<number>;
};
