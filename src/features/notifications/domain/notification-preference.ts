import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import {
  orDefaultQuietAfterDays,
  parseQuietAfterDays,
  type QuietAfterDays,
} from "@/features/reports/domain/gone-quiet";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Version } from "@/shared/domain/audit";
import { checkedSchema } from "@/shared/domain/checked-schema";

import type { Slot } from "./slot";
import { defaultTimes, parseTimeOfDay, type TimeOfDay } from "./time-of-day";

// Read as a module: `import * as NotificationPreferences`

export const timeOfDaySchema = checkedSchema(z.unknown(), parseTimeOfDay);

export const quietAfterDaysSchema = checkedSchema(z.unknown(), parseQuietAfterDays);

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
  // After how many days without an order the morning list names a customer, and the Friday summary counts them
  readonly quietAfterDays: QuietAfterDays;
  // Undefined until the person first changes one: until then they are the defaults, and nothing is stored
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
    quietAfterDays: orDefaultQuietAfterDays(),
    audit: undefined,
  };
}

function changed(
  preference: NotificationPreference,
  changes: Partial<NotificationTimes> | { readonly quietAfterDays: QuietAfterDays },
  by: AccountId,
  at: Temporal.Instant,
): NotificationPreference {
  return {
    ...preference,
    ...changes,
    audit:
      preference.audit === undefined
        ? Audits.start(by, at)
        : Audits.change(preference.audit, by, at),
  };
}

export function change(
  preference: NotificationPreference,
  times: NotificationTimes,
  by: AccountId,
  at: Temporal.Instant,
): NotificationPreference {
  return changed(preference, times, by, at);
}

export function changeQuietAfterDays(
  preference: NotificationPreference,
  days: QuietAfterDays,
  by: AccountId,
  at: Temporal.Instant,
): NotificationPreference {
  return changed(preference, { quietAfterDays: days }, by, at);
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
