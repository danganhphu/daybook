import { Temporal } from "temporal-polyfill/implementation";

import type { Clock } from "@/shared/application/clock";

// Inside a Worker, now only advances on I/O
export const systemClock: Clock = () => Temporal.Now.instant();
