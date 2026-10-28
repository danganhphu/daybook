import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Version } from "@/shared/domain/audit";
import { checkedSchema } from "@/shared/domain/checked-schema";

import type { Slot } from "./slot";
import { defaultTimes, parseTimeOfDay, type TimeOfDay } from "./time-of-day";

// Read as a module: `import * as NotificationPreferences`

export const timeOfDaySchema = checkedSchema(z.unknown(), parseTimeOfDay);

// What the app says on its own, on a schedule
export const digestKinds = ["morning", "weekly"] as const;

export type DigestKind = (typeof digestKinds)[number];

// The summary's weekday, as Temporal numbers them (Monday is 1)
export const weeklyDay = 5;

// Undefined is off
export type NotificationTimes = {
  readonly morningAt: TimeOfDay | undefined;
  readonly weeklyAt: TimeOfDay | undefined;
};

// One person's times. Each person sets their own; nobody else's changes them.
export type NotificationPreference = NotificationTimes & {
  readonly accountId: AccountId;
  // Undefined until the person first changes a time: until then they are the defaults, and nothing is stored
  readonly audit: Audit | undefined;
};

function timeOf(text: string): TimeOfDay {
  const parsed = parseTimeOfDay(text);
  if (!parsed.ok) {
    throw new Error(`Not a time of day: ${text}`);
  }

  return parsed.value;
}

export function defaults(accountId: AccountId): NotificationPreference {
  return {
    accountId,
    morningAt: timeOf(defaultTimes.morning),
    weeklyAt: timeOf(defaultTimes.weekly),
    audit: undefined,
  };
}

export function change(
  preference: NotificationPreference,
  times: NotificationTimes,
  by: AccountId,
  at: Temporal.Instant,
): NotificationPreference {
  return {
    ...preference,
    ...times,
    audit:
      preference.audit === undefined
        ? Audits.start(by, at)
        : Audits.change(preference.audit, by, at),
  };
}

// The screen showed what is stored now: the defaults when nothing is, or the same version
export function isCurrent(preference: NotificationPreference, shown: Version | undefined): boolean {
  return preference.audit === undefined
    ? shown === undefined
    : shown !== undefined && Audits.isCurrent(preference.audit, shown);
}

export function isDue(preference: NotificationPreference, kind: DigestKind, slot: Slot): boolean {
  switch (kind) {
    case "morning":
      return preference.morningAt === slot.time;
    case "weekly":
      return slot.day.dayOfWeek === weeklyDay && preference.weeklyAt === slot.time;
    default:
      return kind satisfies never;
  }
}
