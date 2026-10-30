import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import type { DeletedReminder, LiveReminder, Reminder } from "@/features/reminders/domain/reminder";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { toReminder } from "./reminder-mapping";
import { reminderTable } from "./reminder.table";

export function createReminderRepository(db: Database): ReminderRepository {
  async function whereIn(column: SQLiteColumn, values: ReadonlyArray<string>) {
    const reminders: Reminder[] = [];
    for (let start = 0; start < values.length; start += d1MaxBoundParameters) {
      // oxlint-disable-next-line no-await-in-loop -- one chunk per query, under D1's bound-parameter limit
      const rows = await db
        .select()
        .from(reminderTable)
        .where(inArray(column, values.slice(start, start + d1MaxBoundParameters)));
      reminders.push(...rows.map(toReminder));
    }

    return reminders;
  }

  return {
    async get(id) {
      const [row] = await db.select().from(reminderTable).where(eq(reminderTable.id, id)).limit(1);

      return row === undefined ? undefined : toReminder(row);
    },

    getMany(ids) {
      return whereIn(reminderTable.id, ids);
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
            isNull(reminderTable.deletedWith),
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

    forCustomers(customerIds) {
      return whereIn(reminderTable.customerId, customerIds);
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
