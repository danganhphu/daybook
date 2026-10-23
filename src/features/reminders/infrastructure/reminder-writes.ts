import { eq } from "drizzle-orm";

import type { ReminderWrites } from "@/features/reminders/application/reminder-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toReminderRow } from "./reminder-mapping";
import { reminderTable } from "./reminder.table";

export function createReminderWrites(db: Database, batch: Batch): ReminderWrites {
  return {
    add(reminder) {
      batch.enlist(db.insert(reminderTable).values(toReminderRow(reminder)));
    },

    update(reminder) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toReminderRow(reminder);
      batch.enlist(db.update(reminderTable).set(changes).where(eq(reminderTable.id, reminder.id)));
    },
  };
}
