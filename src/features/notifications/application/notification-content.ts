import type { Temporal } from "temporal-polyfill/implementation";

import type { Notice } from "@/features/notifications/domain/notice";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { Version } from "@/shared/domain/audit";
import type { Content } from "@/shared/domain/content";
import type { Money } from "@/shared/domain/money";

// What a notification is about, before any channel puts it into words: the web's push and the bot's message say the
// same things differently

export type DueItem = {
  // Which reminder, as it stood: the bot's Xong button changes this version or nothing
  readonly reminderId: ReminderId;
  readonly version: Version;
  readonly text: Content;
  readonly dueOn: Temporal.PlainDate;
  readonly customerName: string | undefined;
};

export type MorningContent = {
  readonly kind: "morning";
  readonly day: Temporal.PlainDate;
  // Soonest due first, the overdue ones among them
  readonly due: ReadonlyArray<DueItem>;
  // Customers gone quiet, by name
  readonly quiet: ReadonlyArray<string>;
};

// A week's or a month's orders and money, around a day
export type PeriodSummary = {
  readonly period: "week" | "month";
  readonly day: Temporal.PlainDate;
  readonly orders: number;
  readonly sales: Money;
  readonly received: Money;
  // What is owed on that day, across every order
  readonly owed: Money;
  // Customers gone quiet by then
  readonly quiet: number;
};

export type WeeklyContent = { readonly kind: "weekly" } & Omit<PeriodSummary, "period">;

export type NoticeContent = {
  readonly kind: "notice";
  readonly notice: Notice;
  // Who made the change, when it was the other person
  readonly byOther: string | undefined;
};

export type NotificationContent = MorningContent | WeeklyContent | NoticeContent;
