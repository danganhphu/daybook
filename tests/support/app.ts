import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";

import { createApp } from "../../core/app";
import type { Clock } from "../../core/application/clock";
import { contentSchema, type Content } from "../../core/domain/shared/content";

// A clock the test moves by hand
export function testClock(start: string) {
  let now = Temporal.Instant.from(start);
  const clock: Clock = () => now;

  return {
    clock,
    setTo(iso: string) {
      now = Temporal.Instant.from(iso);
    },
  };
}

// The real application over the test's D1, which tests/setup/d1.ts empties and migrates before every test
export function testApp(clock: Clock) {
  return createApp(env.DB, clock);
}

export function content(text: string): Content {
  return contentSchema.parse(text);
}
