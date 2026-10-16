import type { Temporal } from "temporal-polyfill/implementation";

// Use cases ask the clock; domain functions are handed the instant, so they stay pure.
export type Clock = () => Temporal.Instant;
