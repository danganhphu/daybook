import type { Temporal } from "temporal-polyfill/implementation";

import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { AccessEventWrites } from "./access-writes";
import type { RateLimiter } from "./rate-limiter";

export type AttemptLimit = {
  readonly key: string;
  readonly limit: number;
  readonly window: Temporal.Duration;
};

export type OverLimitDeps = {
  readonly rateLimiter: RateLimiter;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly accessEvents: AccessEventWrites }>;
};

// Counts one attempt against each limit and answers whether it goes over any. The access log, which nothing can
// delete, gets one `rate_limited` per window - on the attempt that crosses a limit - so whatever is sent past it adds
// nothing there, and cannot bury the events people are told about.
export async function overLimit(
  deps: OverLimitDeps,
  limits: ReadonlyArray<AttemptLimit>,
  on: string,
  origin: RequestOrigin,
  now: Temporal.Instant,
): Promise<boolean> {
  const counts = await Promise.all(
    limits.map((limit) => deps.rateLimiter.hit(limit.key, limit.window, now)),
  );
  const crossed = limits.map((limit, index) => (counts[index] ?? 0) - limit.limit);
  if (crossed.every((over) => over <= 0)) {
    return false;
  }
  if (crossed.includes(1)) {
    const work = deps.startUnitOfWork();
    work.accessEvents.add(AccessEvents.record("rate_limited", { detail: { on } }, origin, now));
    await work.commit();
  }

  return true;
}
