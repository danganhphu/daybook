import type { Temporal } from "temporal-polyfill/implementation";

import type { Reminder, ReminderId } from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { ReminderDeps } from "./reminder-deps";

// Read the reminder, refuse a stale screen, apply the change, write it
export async function changeReminder<T extends Reminder, E>(
  deps: Pick<ReminderDeps, "clock" | "reminders" | "startUnitOfWork">,
  input: RecordChange<ReminderId>,
  apply: (reminder: Reminder, at: Temporal.Instant) => Result<T, E> | Promise<Result<T, E>>,
): Promise<Result<T, E | "reminder_not_found" | "reminder_changed_elsewhere">> {
  const reminder = await deps.reminders.get(input.id);
  if (reminder === undefined) {
    return err("reminder_not_found");
  }
  if (!Audits.isCurrent(reminder.audit, input.shown)) {
    return err("reminder_changed_elsewhere");
  }

  const changed = await apply(reminder, deps.clock());
  if (!changed.ok) {
    return changed;
  }

  const work = deps.startUnitOfWork();
  work.reminders.update(changed.value);

  return (await commitUnlessStale(work)) === "stale" ? err("reminder_changed_elsewhere") : changed;
}
