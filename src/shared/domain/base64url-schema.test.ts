import { describe, expect, it } from "vitest";

import { encodeBase64Url } from "./base64url";
import { base64UrlSchema } from "./base64url-schema";

describe("base64UrlSchema", () => {
  const thirtyTwoBytes = base64UrlSchema(32, "not 32 bytes");

  it("given exactly that many bytes, encoded, when parsed, then it passes", () => {
    const encoded = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));

    expect(thirtyTwoBytes.parse(encoded)).toBe(encoded);
  });

  it.each([
    ["one byte short", encodeBase64Url(new Uint8Array(31))],
    ["padded", `${encodeBase64Url(new Uint8Array(32))}=`],
    ["standard base64", `${"A".repeat(42)}+`],
  ])("given %s, when parsed, then it is refused with the message given", (_, value) => {
    const parsed = thirtyTwoBytes.safeParse(value);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("not 32 bytes");
  });
});
