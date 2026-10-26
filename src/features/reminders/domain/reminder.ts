import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Deletion } from "@/shared/domain/audit";
import type { Content } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";

// Read as a module: `import * as Reminders`

export const reminderIdSchema = z.uuid().brand<"ReminderId">();

export type ReminderId = z.infer<typeof reminderIdSchema>;

export type ReminderDetails = {
  readonly text: Content;
  readonly dueOn: Temporal.PlainDate;
  readonly customerId: CustomerId | undefined;
};

export type Completion = {
  readonly doneAt: Temporal.Instant;
  readonly doneBy: AccountId;
};

type ReminderFields = ReminderDetails & {
  readonly id: ReminderId;
  // The message it was made from, when a note became this reminder
  readonly captureId: CaptureId | undefined;
  readonly completion: Completion | undefined;
  readonly audit: Audit;
};

export type LiveReminder = ReminderFields & { readonly status: "live" };

export type DeletedReminder = ReminderFields & {
  readonly status: "deleted";
  readonly deletion: Deletion;
};

export type Reminder = LiveReminder | DeletedReminder;

export function create(
  details: ReminderDetails,
  captureId: CaptureId | undefined,
  by: AccountId,
  at: Temporal.Instant,
): LiveReminder {
  return {
    status: "live",
    id: reminderIdSchema.parse(uuidv7()),
    ...details,
    captureId,
    completion: undefined,
    audit: Audits.start(by, at),
  };
}

export function revise(
  reminder: Reminder,
  details: ReminderDetails,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveReminder, "reminder_deleted"> {
  if (reminder.status === "deleted") {
    return err("reminder_deleted");
  }

  return ok({ ...reminder, ...details, audit: Audits.change(reminder.audit, by, at) });
}

export function complete(
  reminder: Reminder,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveReminder, "reminder_deleted" | "reminder_done"> {
  if (reminder.status === "deleted") {
    return err("reminder_deleted");
  }
  if (reminder.completion !== undefined) {
    return err("reminder_done");
  }

  return ok({
    ...reminder,
    completion: { doneAt: at, doneBy: by },
    audit: Audits.change(reminder.audit, by, at),
  });
}

export function reopen(
  reminder: Reminder,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveReminder, "reminder_deleted" | "reminder_open"> {
  if (reminder.status === "deleted") {
    return err("reminder_deleted");
  }
  if (reminder.completion === undefined) {
    return err("reminder_open");
  }

  return ok({ ...reminder, completion: undefined, audit: Audits.change(reminder.audit, by, at) });
}

// A merge moves every reminder of the customer it hides, done and deleted ones too; nothing else changes
export function reassignCustomer<T extends Reminder>(
  reminder: T,
  customerId: CustomerId,
  by: AccountId,
  at: Temporal.Instant,
): T {
  return { ...reminder, customerId, audit: Audits.change(reminder.audit, by, at) };
}

// Deleting twice changes nothing: what was asked for already holds
export function markDeleted(
  reminder: Reminder,
  by: AccountId,
  at: Temporal.Instant,
): DeletedReminder {
  if (reminder.status === "deleted") {
    return reminder;
  }

  return {
    ...reminder,
    status: "deleted",
    audit: Audits.change(reminder.audit, by, at),
    deletion: Audits.deletion(by, at),
  };
}

export function restore(
  reminder: Reminder,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveReminder, "reminder_not_deleted"> {
  if (reminder.status === "live") {
    return err("reminder_not_deleted");
  }

  const { deletion: _deletion, ...fields } = reminder;

  return ok({ ...fields, status: "live", audit: Audits.change(reminder.audit, by, at) });
}
