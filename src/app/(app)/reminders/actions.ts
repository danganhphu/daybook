"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Reminders from "@/features/reminders/web/commands";
import type { Result } from "@/shared/domain/result";

// Each checks the session and the commands parse every argument. A change refreshes the page it came from, so the
// lists on Hôm nay, the reminders page and a customer's page follow it.

export async function addReminder(input: unknown): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.addReminder(app, session.accountId, input));
}

export async function reviseReminder(
  id: string,
  version: number,
  input: unknown,
): Promise<Reminders.ReminderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.reviseReminder(app, session.accountId, id, version, input));
}

export async function completeReminder(
  id: string,
  version: number,
): Promise<Reminders.ReminderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.completeReminder(app, session.accountId, id, version));
}

export async function reopenReminder(
  id: string,
  version: number,
): Promise<Reminders.ReminderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.reopenReminder(app, session.accountId, id, version));
}

export async function deleteReminder(
  id: string,
  version: number,
): Promise<Reminders.ReminderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.deleteReminder(app, session.accountId, id, version));
}

export async function restoreReminder(
  id: string,
  version: number,
): Promise<Reminders.ReminderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Reminders.restoreReminder(app, session.accountId, id, version));
}

function refreshed<T>(result: Result<T, string>): Result<T, string> {
  refresh();

  return result;
}
