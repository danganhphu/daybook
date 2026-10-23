import * as Reminders from "@/features/reminders/domain/reminder";
import type { ReminderDetails, ReminderId } from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";

import { changeReminder } from "./change-reminder";
import { checkCustomer } from "./check-customer";
import type { ReminderDeps } from "./reminder-deps";

export type ReviseReminderInput = RecordChange<ReminderId> & { readonly details: ReminderDetails };

export function reviseReminder(deps: ReminderDeps, input: ReviseReminderInput) {
  return changeReminder(deps, input, async (reminder, at) => {
    const customer = await checkCustomer(
      deps.customers,
      input.details.customerId,
      reminder.customerId,
    );

    return customer.ok ? Reminders.revise(reminder, input.details, input.by, at) : customer;
  });
}
