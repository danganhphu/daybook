import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { slotAt } from "./slot";
import { parseTimeOfDay, slotTime, timesOfDay } from "./time-of-day";

describe("timesOfDay", () => {
  it("given a day, when its times are listed, then there is one every quarter hour from midnight", () => {
    expect(timesOfDay).toHaveLength(96);
    expect(timesOfDay.slice(0, 3)).toEqual(["00:00", "00:15", "00:30"]);
    expect(timesOfDay.at(-1)).toBe("23:45");
  });
});

describe("parseTimeOfDay", () => {
  it.each(["07:30", "00:00", "23:45"])("given %s, when parsed, then it is a time", (text) => {
    expect(parseTimeOfDay(text)).toEqual({ ok: true, value: text });
  });

  it.each(["07:10", "24:00", "7:30", "07:30:00", 730, undefined])(
    "given %j, when parsed, then it is refused",
    (text) => {
      expect(parseTimeOfDay(text).ok).toBe(false);
    },
  );
});

describe("slotTime", () => {
  it.each([
    [7, 30, "07:30"],
    [7, 44, "07:30"],
    [7, 45, "07:45"],
    [0, 0, "00:00"],
  ])("given %i:%i, when slotted, then it is %s", (hour, minute, slot) => {
    expect(slotTime(hour, minute)).toBe(slot);
  });
});

describe("slotAt", () => {
  it.each([
    ["2026-10-29T00:30:00Z", "2026-10-29", "07:30"],
    // A run that starts late keeps its own slot
    ["2026-10-29T00:30:42Z", "2026-10-29", "07:30"],
    // Midnight in Vietnam is still the day before in UTC
    ["2026-10-28T17:00:00Z", "2026-10-29", "00:00"],
  ])(
    "given the run scheduled at %s, when slotted, then it is %s %s in Vietnam",
    (at, day, time) => {
      const slot = slotAt(Temporal.Instant.from(at));

      expect({ day: slot.day.toString(), time: slot.time }).toEqual({ day, time });
    },
  );
});
