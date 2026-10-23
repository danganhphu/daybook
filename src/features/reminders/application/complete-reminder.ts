import * as Reminders from "@/features/reminders/domain/reminder";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";

import { changeReminder } from "./change-reminder";
import type { ReminderDeps } from "./reminder-deps";

export function completeReminder(deps: ReminderDeps, input: RecordChange<ReminderId>) {
  return changeReminder(deps, input, (reminder, at) => Reminders.complete(reminder, input.by, at));
}

export function reopenReminder(deps: ReminderDeps, input: RecordChange<ReminderId>) {
  return changeReminder(deps, input, (reminder, at) => Reminders.reopen(reminder, input.by, at));
}
