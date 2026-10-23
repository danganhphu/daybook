import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { ReminderWrites } from "./reminder-writes";

export type ReminderDeps = {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly customers: CustomerRepository;
  readonly notes: NoteRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly reminders: ReminderWrites }>;
};
