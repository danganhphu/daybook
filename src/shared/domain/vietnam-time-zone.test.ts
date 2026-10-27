import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { vietnamOffsetMilliseconds, vietnamTimeZone } from "./vietnam-time-zone";

const ianaZone = "Asia/Ho_Chi_Minh";

// The fixed offset stands in for the zone. If the time zone database ever gives Vietnam another offset, this fails
// rather than every day quietly starting at the wrong hour.
describe("vietnamTimeZone", () => {
  it.each([
    "1976-01-01T00:00:00Z",
    "2026-10-27T16:59:59Z",
    "2026-10-27T17:00:00Z",
    "2040-07-01T12:00:00Z",
    Temporal.Now.instant().toString(),
  ])(
    "given %s, when placed in Vietnam, then the fixed offset and Asia/Ho_Chi_Minh agree",
    (iso) => {
      const instant = Temporal.Instant.from(iso);

      expect(instant.toZonedDateTimeISO(vietnamTimeZone).toPlainDateTime()).toEqual(
        instant.toZonedDateTimeISO(ianaZone).toPlainDateTime(),
      );
    },
  );

  it("given the offset in milliseconds, when compared with the zone's today, then they are the same", () => {
    const zoned = Temporal.Now.instant().toZonedDateTimeISO(ianaZone);

    expect(vietnamOffsetMilliseconds * 1_000_000).toBe(zoned.offsetNanoseconds);
  });
});
