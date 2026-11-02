import * as Customers from "@/features/customers/domain/customer";
import * as Reminders from "@/features/reminders/domain/reminder";
import type { DeletedReminder, ReminderId } from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";
import { err, ok } from "@/shared/domain/result";

import { changeReminder } from "./change-reminder";
import type { ReminderDeps } from "./reminder-deps";

// Soft, with Undo. One already deleted, by the other person say, is answered as it is.
export async function deleteReminder(deps: ReminderDeps, input: RecordChange<ReminderId>) {
  const reminder = await deps.reminders.get(input.id);
  if (reminder?.status === "deleted") {
    return ok(reminder);
  }

  return changeReminder<DeletedReminder, never>(deps, input, (current, at) =>
    ok(Reminders.markDeleted(current, input.by, at)),
  );
}

// Never while its customer is in the trash, as for an order
export async function restoreReminder(deps: ReminderDeps, input: RecordChange<ReminderId>) {
  const reminder = await deps.reminders.get(input.id);
  if (
    reminder?.status === "deleted" &&
    reminder.deletedWith === undefined &&
    reminder.customerId !== undefined &&
    Customers.isInTrash(await deps.customers.get(reminder.customerId))
  ) {
    return err("reminder_customer_deleted" as const);
  }

  return changeReminder(deps, input, (current, at) => Reminders.restore(current, input.by, at));
}
