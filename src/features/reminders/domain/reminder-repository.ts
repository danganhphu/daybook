import type { Temporal } from "temporal-polyfill/implementation";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";

import type { DeletedReminder, LiveReminder, Reminder, ReminderId } from "./reminder";

export type OpenReminderFilter = {
  // Due that day or earlier: what needs doing now
  readonly dueBy?: Temporal.PlainDate | undefined;
  readonly customerId?: CustomerId | undefined;
};

// Where a page of finished reminders ends: the next page starts after it
export type DoneCursor = {
  readonly doneAt: Temporal.Instant;
  readonly id: ReminderId;
};

// Reads only; writes go through the unit of work
export type ReminderRepository = {
  get(id: ReminderId): Promise<Reminder | undefined>;
  getMany(ids: ReadonlyArray<ReminderId>): Promise<ReadonlyArray<Reminder>>;
  // Live and not done, soonest due first, at most `limit`
  listOpen(filter: OpenReminderFilter, limit: number): Promise<ReadonlyArray<LiveReminder>>;
  // Live and done, latest finished first, from after `cursor`, at most `limit`
  listDone(after: DoneCursor | undefined, limit: number): Promise<ReadonlyArray<LiveReminder>>;
  // Deleted at or after `since` on their own, not with their customer, latest first, at most `limit`
  listDeleted(since: Temporal.Instant, limit: number): Promise<ReadonlyArray<DeletedReminder>>;
  // Every reminder of the customer, done and deleted ones included
  forCustomer(customerId: CustomerId): Promise<ReadonlyArray<Reminder>>;
  // The same, for several customers
  forCustomers(customerIds: ReadonlyArray<CustomerId>): Promise<ReadonlyArray<Reminder>>;
  // Live ones made from these messages, done or not
  madeFrom(captureIds: ReadonlyArray<CaptureId>): Promise<ReadonlyArray<LiveReminder>>;
};
