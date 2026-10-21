import { describe, expect, it } from "vitest";

import { secretTokenSchema } from "@/features/access/domain/secret";
import { sessionIdSchema } from "@/features/access/domain/session";

import { formatSessionCookie, parseSessionCookie } from "./session-cookie";

const sessionId = sessionIdSchema.parse("019a0000-0000-7000-8000-000000000001");
const secret = secretTokenSchema.parse("C".repeat(43));

describe("parseSessionCookie", () => {
  it("given a formatted cookie, when parsed, then the id and the secret come back", () => {
    expect(parseSessionCookie(formatSessionCookie({ sessionId, secret }))).toEqual({
      sessionId,
      secret,
    });
  });

  it.each([
    ["an empty value", ""],
    ["an id alone", sessionId],
    ["a short secret", `${sessionId}.${"C".repeat(42)}`],
    ["a third part", `${sessionId}.${secret}.extra`],
    ["an id that is not a UUID", `not-a-uuid.${secret}`],
    ["a secret outside base64url", `${sessionId}.${"+".repeat(43)}`],
  ])("given %s, when parsed, then it is no cookie at all", (_, value) => {
    expect(parseSessionCookie(value)).toBeUndefined();
  });
});
