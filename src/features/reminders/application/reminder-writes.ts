import type { Reminder } from "@/features/reminders/domain/reminder";

export type ReminderWrites = {
  add(reminder: Reminder): void;
  update(reminder: Reminder): void;
};
