import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createDatabase } from "@/shared/infrastructure/d1/database";
import { rows } from "@/testing/support/access";

import { createRateLimiter } from "./d1-rate-limiter";

const tenMinutes = Temporal.Duration.from({ minutes: 10 });

function at(iso: string) {
  return Temporal.Instant.from(iso);
}

describe("createRateLimiter", () => {
  it("given hits inside one window, when counted, then each answers its own place in the count", async () => {
    const limiter = createRateLimiter(createDatabase(env.DB));

    expect(await limiter.hit("k", tenMinutes, at("2026-10-21T01:00:00Z"))).toBe(1);
    expect(await limiter.hit("k", tenMinutes, at("2026-10-21T01:09:59Z"))).toBe(2);
  });

  it("given a new window, when hit, then the count starts again", async () => {
    const limiter = createRateLimiter(createDatabase(env.DB));
    await limiter.hit("k", tenMinutes, at("2026-10-21T01:00:00Z"));

    expect(await limiter.hit("k", tenMinutes, at("2026-10-21T01:10:00Z"))).toBe(1);
  });

  it("given other keys, when hit, then they count apart", async () => {
    const limiter = createRateLimiter(createDatabase(env.DB));
    await limiter.hit("a", tenMinutes, at("2026-10-21T01:00:00Z"));

    expect(await limiter.hit("b", tenMinutes, at("2026-10-21T01:00:00Z"))).toBe(1);
  });

  it("given hits arriving together, when counted, then none is lost and none is counted twice", async () => {
    const limiter = createRateLimiter(createDatabase(env.DB));
    const now = at("2026-10-21T01:00:00Z");

    const counts = await Promise.all(
      Array.from({ length: 5 }, () => limiter.hit("k", tenMinutes, now)),
    );

    expect(counts.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("given windows long over, when another hit lands, then their rows are dropped", async () => {
    const limiter = createRateLimiter(createDatabase(env.DB));
    await limiter.hit("old", tenMinutes, at("2026-10-21T01:00:00Z"));

    await limiter.hit("new", tenMinutes, at("2026-10-21T03:00:00Z"));

    expect(await rows("select key from rate_limit")).toEqual([{ key: "new" }]);
  });
});
