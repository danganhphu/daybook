import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { noteIdSchema, type NoteId } from "@/features/notes/domain/note";
import {
  reminderErrorMessages,
  type ReminderError,
} from "@/features/reminders/application/reminder-errors";
import {
  reminderIdSchema,
  type LiveReminder,
  type Reminder,
  type ReminderDetails,
} from "@/features/reminders/domain/reminder";
import type { DoneCursor } from "@/features/reminders/domain/reminder-repository";
import type { RecordChange } from "@/shared/application/record-change";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { parseContent } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { dayLabel } from "@/shared/web/day-label";
import { recentlyDeleted, type DeletedRowView } from "@/shared/web/recently-deleted";
import { deletedText, recentlyDeletedSince } from "@/shared/web/recently-deleted-since";

import type { DoneRemindersView, DueView, ReminderGroup, ReminderView } from "./reminder-view";
import { doneText, overdueBy, remindersCopy } from "./reminders-copy";
import { doneRemindersPath } from "./reminders-path";

// Far more than two people keep open at once; a screen never needs a second page
const screenLimit = 200;

function dueText(
  dueOn: Temporal.PlainDate,
  today: Temporal.PlainDate,
): Pick<ReminderView, "due" | "overdue"> {
  const late = dueOn.until(today, { largestUnit: "days" }).days;
  if (late > 0) {
    return { due: overdueBy(late), overdue: true };
  }

  const due =
    late === 0
      ? remindersCopy.today
      : late === -1
        ? remindersCopy.tomorrow
        : dayLabel(dueOn, today);

  return { due, overdue: false };
}

async function toViews(
  app: App,
  reminders: ReadonlyArray<Reminder>,
): Promise<ReadonlyArray<ReminderView>> {
  const today = app.today();
  const ids = [...new Set(reminders.flatMap((reminder) => reminder.customerId ?? []))];
  const names = new Map(
    (await app.getCustomers(ids)).map((customer) => [customer.id, customer.name]),
  );

  return reminders.map((reminder) => {
    const name = reminder.customerId === undefined ? undefined : names.get(reminder.customerId);

    return {
      id: reminder.id,
      version: reminder.audit.version,
      text: reminder.text,
      dueOn: reminder.dueOn.toString(),
      ...dueText(reminder.dueOn, today),
      customer:
        reminder.customerId === undefined || name === undefined
          ? undefined
          : { id: reminder.customerId, name },
    };
  });
}

export async function dueReminders(app: App): Promise<DueView | undefined> {
  const due = await app.listOpenReminders({ dueBy: app.today() }, screenLimit);
  const [first] = due;
  if (first === undefined) {
    return undefined;
  }

  const [view] = await toViews(app, [first]);

  return view === undefined ? undefined : { first: view, more: due.length - 1 };
}

export type RemindersScreenView = {
  readonly today: string;
  // Overdue first, then by due day
  readonly groups: ReadonlyArray<ReminderGroup>;
};

export async function remindersScreen(app: App): Promise<RemindersScreenView> {
  const views = await toViews(app, await app.listOpenReminders({}, screenLimit));
  const byDay = Map.groupBy(views, (view) => (view.overdue ? remindersCopy.overdue : view.due));

  return {
    today: app.today().toString(),
    groups: [...byDay].map(([label, reminders]) => ({ label, reminders })),
  };
}

// A page of finished reminders: a few weeks of them
export const doneRemindersPage = 50;

// Where a page ends, as the next page's address carries it: "<done at, ms>_<id>"
const cursorPattern = /^(\d{1,16})_([0-9a-f-]{36})$/;

function cursorText(reminder: LiveReminder): string | undefined {
  return reminder.completion === undefined
    ? undefined
    : `${reminder.completion.doneAt.epochMilliseconds}_${reminder.id}`;
}

function parseCursor(text: unknown): DoneCursor | undefined {
  const match = typeof text === "string" ? cursorPattern.exec(text) : null;
  const id = reminderIdSchema.safeParse(match?.[2]);
  if (match?.[1] === undefined || !id.success) {
    return undefined;
  }

  return { doneAt: Temporal.Instant.fromEpochMilliseconds(Number(match[1])), id: id.data };
}

export async function doneReminders(
  app: App,
  params: { readonly after?: unknown },
): Promise<DoneRemindersView> {
  const found = await app.listDoneReminders(parseCursor(params.after), doneRemindersPage + 1);
  const shown = found.slice(0, doneRemindersPage);
  const customerIds = [...new Set(shown.flatMap((reminder) => reminder.customerId ?? []))];
  const [people, customers] = await Promise.all([
    app.displayNames(),
    app.getCustomers(customerIds),
  ]);
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const last = shown.at(-1);
  const next =
    found.length > doneRemindersPage && last !== undefined ? cursorText(last) : undefined;

  return {
    reminders: shown.flatMap((reminder) => {
      if (reminder.completion === undefined) {
        return [];
      }
      const day = vietnamDate(reminder.completion.doneAt);
      const done = doneText(
        `${day.day}/${day.month}`,
        people.get(reminder.completion.doneBy) ?? "?",
      );
      const customer =
        reminder.customerId === undefined ? undefined : customerNames.get(reminder.customerId);

      return [
        {
          id: reminder.id,
          version: reminder.audit.version,
          text: reminder.text,
          detail: customer === undefined ? done : `${done}, ${customer}`,
        },
      ];
    }),
    nextPath: next === undefined ? undefined : doneRemindersPath(next),
  };
}

// Reminders deleted lately, for "Đã xoá gần đây"; `people` names who deleted each
export async function deletedReminders(
  app: App,
  people: ReadonlyMap<AccountId, string>,
): Promise<ReadonlyArray<DeletedRowView>> {
  const reminders = await app.listDeletedReminders(
    recentlyDeletedSince(app.now()),
    recentlyDeleted.limit,
  );

  return reminders.map((reminder) => ({
    id: reminder.id,
    version: reminder.audit.version,
    title: reminder.text,
    detail: deletedText(
      reminder.deletion.deletedAt,
      people.get(reminder.deletion.deletedBy) ?? "?",
    ),
  }));
}

export type CustomerRemindersView = {
  readonly today: string;
  readonly reminders: ReadonlyArray<ReminderView>;
};

export async function customerReminders(app: App, id: unknown): Promise<CustomerRemindersView> {
  const customerId = customerIdSchema.safeParse(id);
  const reminders = customerId.success
    ? await app.listOpenReminders({ customerId: customerId.data }, screenLimit)
    : [];

  return { today: app.today().toString(), reminders: await toViews(app, reminders) };
}

// What the reminder form sends; an empty string is a field left empty
const reminderFormSchema = z.object({
  text: z.string(),
  dueOn: z.string(),
  customerId: z.string(),
  noteId: z.string().optional(),
});

export type ReminderFormInput = z.input<typeof reminderFormSchema>;

type ParsedForm = { readonly details: ReminderDetails; readonly fromNote: NoteId | undefined };

function parseForm(input: unknown): Result<ParsedForm, string> {
  const form = reminderFormSchema.safeParse(input);
  if (!form.success) {
    return err(remindersCopy.refused);
  }

  const text = parseContent(form.data.text);
  if (!text.ok) {
    return text;
  }
  const dueOn = calendarDaySchema.safeParse(form.data.dueOn);
  const customerId =
    form.data.customerId === "" ? undefined : customerIdSchema.safeParse(form.data.customerId);
  const noteId =
    form.data.noteId === undefined || form.data.noteId === ""
      ? undefined
      : noteIdSchema.safeParse(form.data.noteId);
  if (!dueOn.success || customerId?.success === false || noteId?.success === false) {
    return err(remindersCopy.refused);
  }

  return ok({
    details: { text: text.value, dueOn: dueOn.data, customerId: customerId?.data },
    fromNote: noteId?.data,
  });
}

function refusal(error: ReminderError): string {
  return reminderErrorMessages[error];
}

// Answers the new reminder's id
export async function addReminder(
  app: App,
  by: AccountId,
  input: unknown,
): Promise<Result<string, string>> {
  const form = parseForm(input);
  if (!form.ok) {
    return form;
  }

  const added = await app.addReminder({ by, ...form.value });

  return added.ok ? ok(added.value.id) : err(refusal(added.error));
}

// A change answers the reminder's new version, for an Undo right after it, or the sentence to show
export type ReminderChangeResult = Result<number, string>;

function parseChange(
  by: AccountId,
  id: unknown,
  version: unknown,
): RecordChange<Reminder["id"]> | undefined {
  const reminderId = reminderIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return reminderId.success && shown.success
    ? { id: reminderId.data, by, shown: shown.data }
    : undefined;
}

function answered(result: Result<Reminder, ReminderError>): ReminderChangeResult {
  return result.ok ? ok(result.value.audit.version) : err(refusal(result.error));
}

export async function reviseReminder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  input: unknown,
): Promise<ReminderChangeResult> {
  const change = parseChange(by, id, version);
  if (change === undefined) {
    return err(reminderErrorMessages.reminder_not_found);
  }
  const form = parseForm(input);
  if (!form.ok) {
    return form;
  }

  return answered(await app.reviseReminder({ ...change, details: form.value.details }));
}

type ChangeName = "completeReminder" | "reopenReminder" | "deleteReminder" | "restoreReminder";

async function changed(
  app: App,
  name: ChangeName,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<ReminderChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(reminderErrorMessages.reminder_not_found)
    : answered(await app[name](change));
}

export function completeReminder(app: App, by: AccountId, id: unknown, version: unknown) {
  return changed(app, "completeReminder", by, id, version);
}

export function reopenReminder(app: App, by: AccountId, id: unknown, version: unknown) {
  return changed(app, "reopenReminder", by, id, version);
}

export function deleteReminder(app: App, by: AccountId, id: unknown, version: unknown) {
  return changed(app, "deleteReminder", by, id, version);
}

export function restoreReminder(app: App, by: AccountId, id: unknown, version: unknown) {
  return changed(app, "restoreReminder", by, id, version);
}
