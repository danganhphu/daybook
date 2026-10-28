import type { Temporal } from "temporal-polyfill/implementation";

import type { DeliveryKey, DeliveryStatus } from "@/features/notifications/domain/delivery";

// The record of what was sent, which makes a delivery idempotent (Idempotent Consumer). Writes straight away rather
// than on a unit of work: a claim has to know at once whether it won.
export type DeliveryLedger = {
  // Takes the delivery unless it is finished: true the first time, and again for a retry of one that never finished.
  // One statement, so a second run of a finished job finds nothing to take.
  claim(key: DeliveryKey, at: Temporal.Instant): Promise<boolean>;
  finish(
    key: DeliveryKey,
    status: Exclude<DeliveryStatus, "claimed">,
    at: Temporal.Instant,
  ): Promise<void>;
  forget(before: Temporal.Instant): Promise<void>;
};
