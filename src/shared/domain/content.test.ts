import { describe, expect, it } from "vitest";

import { contentMaxLength, contentSchema } from "./content";

describe("contentSchema", () => {
  it("given text with spaces, line breaks and diacritics, when parsed, then it is kept exactly as typed", () => {
    const typed = "  bán 2 hộp gel tê\ncho PK chị Lan 500k  ";

    expect(contentSchema.parse(typed)).toBe(typed);
  });

  it.each(["", "   ", "\n\t "])(
    "given blank input %j, when parsed, then it is refused",
    (blank) => {
      expect(contentSchema.safeParse(blank).success).toBe(false);
    },
  );

  it("given text at the limit, when parsed, then it is accepted, and one character more is refused", () => {
    expect(contentSchema.safeParse("a".repeat(contentMaxLength)).success).toBe(true);
    expect(contentSchema.safeParse("a".repeat(contentMaxLength + 1)).success).toBe(false);
  });
});
