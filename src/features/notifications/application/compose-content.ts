import { Temporal } from "temporal-polyfill/implementation";

import type { AccessEventRepository } from "@/features/access/domain/access-event-repository";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import { isNotice } from "@/features/notifications/domain/notice";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import type { ReminderRepository } from "@/features/reminders/domain/reminder-repository";
import type { ReportQueries } from "@/features/reports/application/report-queries";
import { quietCutoff } from "@/features/reports/domain/gone-quiet";
import { periodContaining } from "@/features/reports/domain/report-period";
import type { AccountId } from "@/shared/domain/account-id";

import type {
  MorningContent,
  NoticeContent,
  NotificationContent,
  WeeklyContent,
} from "./notification-content";
import type { NotificationJob } from "./notification-job";

export type ContentSources = {
  readonly reminders: ReminderRepository;
  readonly customers: CustomerRepository;
  readonly reports: ReportQueries;
  readonly preferences: NotificationPreferenceRepository;
  readonly accessEvents: AccessEventRepository;
  readonly accounts: AccountRepository;
};

export const contentLimits = {
  // Every reminder due counts; a notification names the first few
  due: 50,
  quiet: 5,
  // Counted for the summary, not named
  weeklyQuiet: 100,
} as const;

// By the person's own number of days, as the reports find them; the cutoff is the last order day that makes one quiet
async function quietOn(
  sources: ContentSources,
  accountId: AccountId,
  day: Temporal.PlainDate,
  limit: number,
) {
  const preference =
    (await sources.preferences.get(accountId)) ?? NotificationPreferences.defaults(accountId);
  const cutoff = quietCutoff(day, preference.quietAfterDays);

  return { cutoff, customers: await sources.reports.quietCustomers(cutoff, undefined, limit) };
}

// A customer goes in the morning list on the day they go quiet, not every morning after: the reports keep the whole
// list, and a notification that repeats itself is soon ignored
async function newlyQuiet(sources: ContentSources, accountId: AccountId, day: Temporal.PlainDate) {
  const { cutoff, customers } = await quietOn(sources, accountId, day, contentLimits.quiet);

  return customers.filter((customer) => customer.lastOrderedOn.equals(cutoff));
}

async function morning(
  sources: ContentSources,
  accountId: AccountId,
  day: Temporal.PlainDate,
): Promise<MorningContent | undefined> {
  const [due, quiet] = await Promise.all([
    sources.reminders.listOpen({ dueBy: day }, contentLimits.due),
    newlyQuiet(sources, accountId, day),
  ]);
  if (due.length === 0 && quiet.length === 0) {
    return undefined;
  }

  const customerIds = [...new Set(due.flatMap((reminder) => reminder.customerId ?? []))];
  const names = new Map(
    (await sources.customers.getMany(customerIds)).map((customer) => [customer.id, customer.name]),
  );

  return {
    kind: "morning",
    day,
    due: due.map((reminder) => ({
      text: reminder.text,
      dueOn: reminder.dueOn,
      customerName: reminder.customerId === undefined ? undefined : names.get(reminder.customerId),
    })),
    quiet: quiet.map((customer) => customer.name),
  };
}

async function weekly(
  sources: ContentSources,
  accountId: AccountId,
  day: Temporal.PlainDate,
): Promise<WeeklyContent> {
  const week = periodContaining("week", day);
  const range = { from: week.from, to: week.to };
  const [sales, received, owed, quiet] = await Promise.all([
    sources.reports.sales(range),
    sources.reports.received(range),
    sources.reports.owedAt(day, {}),
    quietOn(sources, accountId, day, contentLimits.weeklyQuiet),
  ]);

  return {
    kind: "weekly",
    day,
    orders: sales.orders,
    sales: sales.sales,
    received,
    owed,
    quiet: quiet.customers.length,
  };
}

async function notice(
  sources: ContentSources,
  job: Extract<NotificationJob, { kind: "notice" }>,
): Promise<NoticeContent | undefined> {
  const event = await sources.accessEvents.get(job.eventId);
  if (event === undefined || !isNotice(event)) {
    return undefined;
  }
  const actor =
    event.actorId !== undefined && event.actorId !== event.accountId
      ? await sources.accounts.get(event.actorId)
      : undefined;

  return { kind: "notice", notice: event, byOther: actor?.displayName };
}

// What a job's message is about, read when it is sent. Undefined when there is nothing to say: a quiet morning, an
// event that is not a notice after all.
export async function composeContent(
  sources: ContentSources,
  job: NotificationJob,
): Promise<NotificationContent | undefined> {
  switch (job.kind) {
    case "digest": {
      const day = Temporal.PlainDate.from(job.day);
      return job.digest === "morning"
        ? morning(sources, job.accountId, day)
        : weekly(sources, job.accountId, day);
    }
    case "notice":
      return notice(sources, job);
    default:
      return job satisfies never;
  }
}
