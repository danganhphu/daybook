import { Temporal } from "temporal-polyfill/implementation";

import { captureIdSchema } from "@/features/capture/domain/capture";
import { customerIdSchema } from "@/features/customers/domain/customer";
import {
  reminderIdSchema,
  type Completion,
  type Reminder,
} from "@/features/reminders/domain/reminder";
import { accountIdSchema } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { contentSchema } from "@/shared/domain/content-schema";
import {
  toAudit,
  toAuditRow,
  toDeletion,
  toDeletionRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { reminderTable } from "./reminder.table";

type ReminderRow = typeof reminderTable.$inferSelect;

function toCompletion(row: ReminderRow): Completion | undefined {
  if (row.doneAt === null || row.doneBy === null) {
    return undefined;
  }

  return {
    doneAt: Temporal.Instant.fromEpochMilliseconds(row.doneAt),
    doneBy: accountIdSchema.parse(row.doneBy),
  };
}

export function toReminder(row: ReminderRow): Reminder {
  const fields = {
    id: reminderIdSchema.parse(row.id),
    captureId: row.captureId === null ? undefined : captureIdSchema.parse(row.captureId),
    text: contentSchema.parse(row.text),
    dueOn: calendarDaySchema.parse(row.dueOn),
    customerId: row.customerId === null ? undefined : customerIdSchema.parse(row.customerId),
    completion: toCompletion(row),
    audit: toAudit(row),
  };
  const deletion = toDeletion(row);

  return deletion === undefined
    ? { ...fields, status: "live" }
    : {
        ...fields,
        status: "deleted",
        deletion,
        deletedWith: row.deletedWith === null ? undefined : customerIdSchema.parse(row.deletedWith),
      };
}

export function toReminderRow(reminder: Reminder): ReminderRow {
  return {
    id: reminder.id,
    captureId: reminder.captureId ?? null,
    text: reminder.text,
    dueOn: reminder.dueOn.toString(),
    customerId: reminder.customerId ?? null,
    doneAt: reminder.completion?.doneAt.epochMilliseconds ?? null,
    doneBy: reminder.completion?.doneBy ?? null,
    ...toAuditRow(reminder.audit),
    ...toDeletionRow(reminder.status === "deleted" ? reminder.deletion : undefined),
    deletedWith: reminder.status === "deleted" ? (reminder.deletedWith ?? null) : null,
  };
}
