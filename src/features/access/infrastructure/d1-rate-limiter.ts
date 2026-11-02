import { and, eq, lt, or, sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import type { RateLimiter } from "@/features/access/application/rate-limiter";
import type { Database } from "@/shared/infrastructure/d1/database";

import { rateLimitTable } from "./rate-limit.table";

// Longer than any window a limit counts in, so pruning other keys never resets a count still running
const keptFor = Temporal.Duration.from({ hours: 24 }).total("milliseconds");

// Exact counts in D1 rather than the approximate per-location rate-limit binding: a one-time code needs a count it can
// trust. The same batch drops this key's ended windows and anything a day old, so the table stays a few rows long.
export function createRateLimiter(db: Database): RateLimiter {
  return {
    async hit(key, window, now) {
      const size = window.total("milliseconds");
      const windowStart = Math.floor(now.epochMilliseconds / size) * size;

      const [counted] = await db.batch([
        db
          .insert(rateLimitTable)
          .values({ key, windowStart, hits: 1 })
          .onConflictDoUpdate({
            target: [rateLimitTable.key, rateLimitTable.windowStart],
            set: { hits: sql`${rateLimitTable.hits} + 1` },
          })
          .returning({ hits: rateLimitTable.hits }),
        db
          .delete(rateLimitTable)
          .where(
            or(
              and(eq(rateLimitTable.key, key), lt(rateLimitTable.windowStart, windowStart)),
              lt(rateLimitTable.windowStart, now.epochMilliseconds - keptFor),
            ),
          ),
      ]);

      const [row] = counted;
      if (row === undefined) {
        throw new Error("The rate-limit upsert returned no row");
      }

      return row.hits;
    },
  };
}
