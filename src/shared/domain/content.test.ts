import { describe, expect, it } from "vitest";

import { contentMaxLength, contentSchema, parseContent } from "./content";

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

describe("parseContent", () => {
  it("given her words, when parsed, then they come back unchanged", () => {
    expect(parseContent(" gel tê x2 ")).toEqual({ ok: true, value: " gel tê x2 " });
  });

  it("given blank input, when parsed, then the reason is the sentence she reads", () => {
    expect(parseContent("  ")).toEqual({ ok: false, error: "Chưa có nội dung" });
  });

  it("given too much text, when parsed, then the reason names the limit", () => {
    expect(parseContent("a".repeat(contentMaxLength + 1))).toEqual({
      ok: false,
      error: `Tối đa ${contentMaxLength} ký tự`,
    });
  });

  it("given something that is not text, as anything from a browser can be, when parsed, then it is refused", () => {
    expect(parseContent(42).ok).toBe(false);
  });
});
