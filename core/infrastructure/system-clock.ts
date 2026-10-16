import { Temporal } from "temporal-polyfill/implementation";

import type { Clock } from "../application/clock";

// Inside a Worker, now only advances on I/O
export const systemClock: Clock = () => Temporal.Now.instant();
