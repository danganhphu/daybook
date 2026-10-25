import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

import type { LiveReminder } from "@/features/reminders/domain/reminder";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toReminder } from "./reminder-mapping";
import { reminderTable } from "./reminder.table";

export function createReminderRepository(db: Database): ReminderRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(reminderTable).where(eq(reminderTable.id, id)).limit(1);

      return row === undefined ? undefined : toReminder(row);
    },

    async listOpen(filter, limit) {
      const rows = await db
        .select()
        .from(reminderTable)
        .where(
          and(
            isNull(reminderTable.doneAt),
            isNull(reminderTable.deletedAt),
            filter.dueBy === undefined
              ? undefined
              : lte(reminderTable.dueOn, filter.dueBy.toString()),
            filter.customerId === undefined
              ? undefined
              : eq(reminderTable.customerId, filter.customerId),
          ),
        )
        .orderBy(asc(reminderTable.dueOn), asc(reminderTable.id))
        .limit(limit);

      return rows
        .map(toReminder)
        .filter((reminder): reminder is LiveReminder => reminder.status === "live");
    },

    async madeFrom(captureIds) {
      if (captureIds.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(reminderTable)
        .where(
          and(isNull(reminderTable.deletedAt), inArray(reminderTable.captureId, [...captureIds])),
        );

      return rows
        .map(toReminder)
        .filter((reminder): reminder is LiveReminder => reminder.status === "live");
    },
  };
}
