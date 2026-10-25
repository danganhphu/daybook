import type { Temporal } from "temporal-polyfill/implementation";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";

import type { LiveReminder, Reminder, ReminderId } from "./reminder";

export type OpenReminderFilter = {
  // Due that day or earlier: what needs doing now
  readonly dueBy?: Temporal.PlainDate | undefined;
  readonly customerId?: CustomerId | undefined;
};

// Reads only; writes go through the unit of work
export type ReminderRepository = {
  get(id: ReminderId): Promise<Reminder | undefined>;
  // Live and not done, soonest due first, at most `limit`
  listOpen(filter: OpenReminderFilter, limit: number): Promise<ReadonlyArray<LiveReminder>>;
  // Live ones made from these messages, done or not
  madeFrom(captureIds: ReadonlyArray<CaptureId>): Promise<ReadonlyArray<LiveReminder>>;
};
