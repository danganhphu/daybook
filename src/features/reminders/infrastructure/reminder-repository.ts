import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";

import type { DeletedReminder, LiveReminder } from "@/features/reminders/domain/reminder";
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

    // By the partial index on (done_at, id), read backwards; a cursor rather than an offset, so a reminder reopened
    // or finished between two pages never shifts the next one
    async listDone(after, limit) {
      const rows = await db
        .select()
        .from(reminderTable)
        .where(
          and(
            isNotNull(reminderTable.doneAt),
            isNull(reminderTable.deletedAt),
            after === undefined
              ? undefined
              : or(
                  lt(reminderTable.doneAt, after.doneAt.epochMilliseconds),
                  and(
                    eq(reminderTable.doneAt, after.doneAt.epochMilliseconds),
                    lt(reminderTable.id, after.id),
                  ),
                ),
          ),
        )
        .orderBy(desc(reminderTable.doneAt), desc(reminderTable.id))
        .limit(limit);

      return rows
        .map(toReminder)
        .filter((reminder): reminder is LiveReminder => reminder.status === "live");
    },

    async listDeleted(since, limit) {
      const rows = await db
        .select()
        .from(reminderTable)
        .where(
          and(
            isNotNull(reminderTable.deletedAt),
            gte(reminderTable.deletedAt, since.epochMilliseconds),
          ),
        )
        .orderBy(desc(reminderTable.deletedAt), desc(reminderTable.id))
        .limit(limit);

      return rows
        .map(toReminder)
        .filter((reminder): reminder is DeletedReminder => reminder.status === "deleted");
    },

    async forCustomer(customerId) {
      const rows = await db
        .select()
        .from(reminderTable)
        .where(eq(reminderTable.customerId, customerId));

      return rows.map(toReminder);
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
