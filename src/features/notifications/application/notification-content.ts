import type { Temporal } from "temporal-polyfill/implementation";

import type { Notice } from "@/features/notifications/domain/notice";
import type { Content } from "@/shared/domain/content";
import type { Money } from "@/shared/domain/money";

// What a notification is about, before any channel puts it into words: the web's push and the bot's message say the
// same things differently

export type DueItem = {
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

export type WeeklyContent = {
  readonly kind: "weekly";
  readonly day: Temporal.PlainDate;
  readonly orders: number;
  readonly sales: Money;
  readonly received: Money;
  readonly owed: Money;
  readonly quiet: number;
};

export type NoticeContent = {
  readonly kind: "notice";
  readonly notice: Notice;
  // Who made the change, when it was the other person
  readonly byOther: string | undefined;
};

export type NotificationContent = MorningContent | WeeklyContent | NoticeContent;
