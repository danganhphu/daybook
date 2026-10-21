import { describe, expect, it } from "vitest";

import { base64UrlLength, decodeBase64Url, encodeBase64Url } from "./base64url";

describe("encodeBase64Url", () => {
  it("given bytes that base64 would write as + and /, when encoded, then it uses - and _ and no padding", () => {
    expect(encodeBase64Url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
  });

  it("given 32 bytes, when encoded, then the text is 43 characters long, as the table checks expect", () => {
    expect(encodeBase64Url(new Uint8Array(32).fill(7))).toHaveLength(43);
    expect(base64UrlLength(32)).toBe(43);
  });
});

describe("decodeBase64Url", () => {
  it("given encoded bytes, when decoded, then the same bytes come back", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));

    expect(decodeBase64Url(encodeBase64Url(bytes))).toEqual(bytes);
  });
});
