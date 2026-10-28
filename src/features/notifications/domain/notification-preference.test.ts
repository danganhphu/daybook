import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { anAuthorId } from "@/testing/support/app";

import * as NotificationPreferences from "./notification-preference";
import { slotAt } from "./slot";
import { parseTimeOfDay, type TimeOfDay } from "./time-of-day";

function time(text: string): TimeOfDay {
  const parsed = parseTimeOfDay(text);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

// Thursday 29 and Friday 30 October 2026, in Vietnam
const thursdayMorning = slotAt(Temporal.Instant.from("2026-10-29T00:30:00Z"));
const fridayEvening = slotAt(Temporal.Instant.from("2026-10-30T10:00:00Z"));
const thursdayEvening = slotAt(Temporal.Instant.from("2026-10-29T10:00:00Z"));

describe("isDue", () => {
  const defaults = NotificationPreferences.defaults(anAuthorId);

  it("given the default times, when the 07:30 slot comes, then the morning list is due and the summary is not", () => {
    expect(NotificationPreferences.isDue(defaults, "morning", thursdayMorning)).toBe(true);
    expect(NotificationPreferences.isDue(defaults, "weekly", thursdayMorning)).toBe(false);
  });

  it("given the default times, when 17:00 comes, then the summary is due on a Friday only", () => {
    expect(NotificationPreferences.isDue(defaults, "weekly", fridayEvening)).toBe(true);
    expect(NotificationPreferences.isDue(defaults, "weekly", thursdayEvening)).toBe(false);
  });

  it("given the morning list turned off, when its slot comes, then it is not due", () => {
    const off = NotificationPreferences.change(
      defaults,
      { morningAt: undefined, weeklyAt: defaults.weeklyAt },
      anAuthorId,
      Temporal.Instant.from("2026-10-28T01:00:00Z"),
    );

    expect(NotificationPreferences.isDue(off, "morning", thursdayMorning)).toBe(false);
  });
});

describe("change", () => {
  it("given the defaults, when a time is first changed, then the record starts at version 1; again, version 2", () => {
    const at = Temporal.Instant.from("2026-10-28T01:00:00Z");
    const first = NotificationPreferences.change(
      NotificationPreferences.defaults(anAuthorId),
      { morningAt: time("06:45"), weeklyAt: undefined },
      anAuthorId,
      at,
    );
    const second = NotificationPreferences.change(
      first,
      { morningAt: time("07:00"), weeklyAt: undefined },
      anAuthorId,
      at,
    );

    expect(first.audit?.version).toBe(1);
    expect(second.audit?.version).toBe(2);
    expect(second.audit?.createdAt).toEqual(at);
  });
});

describe("isCurrent", () => {
  it("given times saved once, when the screen still showed the defaults, then it is stale; showing version 1, current", () => {
    const defaults = NotificationPreferences.defaults(anAuthorId);
    const saved = NotificationPreferences.change(
      defaults,
      { morningAt: time("06:45"), weeklyAt: undefined },
      anAuthorId,
      Temporal.Instant.from("2026-10-28T01:00:00Z"),
    );

    expect(NotificationPreferences.isCurrent(defaults, undefined)).toBe(true);
    expect(NotificationPreferences.isCurrent(saved, undefined)).toBe(false);
    expect(NotificationPreferences.isCurrent(saved, saved.audit?.version)).toBe(true);
  });
});
