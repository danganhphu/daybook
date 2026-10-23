import * as Reminders from "@/features/reminders/domain/reminder";
import type { DeletedReminder, ReminderId } from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";
import { ok } from "@/shared/domain/result";

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

export function restoreReminder(deps: ReminderDeps, input: RecordChange<ReminderId>) {
  return changeReminder(deps, input, (reminder, at) => Reminders.restore(reminder, input.by, at));
}
