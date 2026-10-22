import { describe, expect, it } from "vitest";

import { ceremonyIdSchema } from "@/features/access/domain/ceremony";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";

import { formatCeremonyCookie, parseCeremonyCookie } from "./ceremony-cookie";
import { newSecretToken } from "./secret-tokens";

const ceremonyId = ceremonyIdSchema.parse("019a0000-0000-7000-8000-000000000001");

describe("ceremony cookie", () => {
  it("given a ceremony and its binding, when formatted and parsed, then both come back", () => {
    const binding = newSecretToken(webCryptoSecrets);

    expect(parseCeremonyCookie(formatCeremonyCookie({ ceremonyId, binding }))).toEqual({
      ceremonyId,
      binding,
    });
  });

  it.each([
    [""],
    ["no-dot"],
    [`${ceremonyId}.`],
    [`${ceremonyId}.short`],
    [`not-a-uuid.${"A".repeat(43)}`],
    [`${ceremonyId}.${"A".repeat(43)}.extra`],
  ])("given %j, when parsed, then it is no cookie", (value) => {
    expect(parseCeremonyCookie(value)).toBeUndefined();
  });
});
