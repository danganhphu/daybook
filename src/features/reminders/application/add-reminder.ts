import type { CaptureId } from "@/features/capture/domain/capture";
import type { NoteId } from "@/features/notes/domain/note";
import * as Reminders from "@/features/reminders/domain/reminder";
import type { LiveReminder, ReminderDetails } from "@/features/reminders/domain/reminder";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import { checkCustomer } from "./check-customer";
import type { ReminderDeps } from "./reminder-deps";
import type { ReminderError } from "./reminder-errors";

export type AddReminderInput = {
  readonly by: AccountId;
  readonly details: ReminderDetails;
  // The note it was made from; the reminder keeps that note's capture
  readonly fromNote: NoteId | undefined;
};

export async function addReminder(
  deps: ReminderDeps,
  input: AddReminderInput,
): Promise<
  Result<LiveReminder, Extract<ReminderError, "customer_unavailable" | "note_unavailable">>
> {
  const customer = await checkCustomer(deps.customers, input.details.customerId, undefined);
  if (!customer.ok) {
    return customer;
  }

  let captureId: CaptureId | undefined;
  if (input.fromNote !== undefined) {
    const note = await deps.notes.get(input.fromNote);
    if (note?.status !== "live") {
      return err("note_unavailable");
    }
    captureId = note.captureId;
  }

  const reminder = Reminders.create(input.details, captureId, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.reminders.add(reminder);
  await work.commit();

  return ok(reminder);
}
