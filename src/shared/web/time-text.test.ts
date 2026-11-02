import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { clockTime, momentText } from "./time-text";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("clockTime", () => {
  it("given the last minute of a Vietnamese day, when shown, then it reads 23:59", () => {
    expect(clockTime(at("2026-10-19T16:59:59Z").epochMilliseconds)).toBe("23:59");
  });

  it("given midnight in Vietnam, when shown, then it reads 00:00, not 24:00", () => {
    expect(clockTime(at("2026-10-19T17:00:00Z").epochMilliseconds)).toBe("00:00");
  });
});

describe("momentText", () => {
  it("given an instant, when shown, then it reads in Vietnam's time, hour first", () => {
    expect(momentText(at("2026-10-22T09:02:00Z"))).toBe("16:02 22/10");
  });

  it("given an evening in UTC that is the next morning in Vietnam, when shown, then the day is Vietnam's, unpadded", () => {
    expect(momentText(at("2026-09-01T17:30:00Z"))).toBe("00:30 2/9");
  });
});
