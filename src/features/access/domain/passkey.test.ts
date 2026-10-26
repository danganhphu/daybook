import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";

import * as Passkeys from "./passkey";
import { credentialIdSchema } from "./passkey";
import { deviceLabelSchema } from "./session";

const createdAt = Temporal.Instant.from("2026-10-22T01:00:00Z");
const usedAt = Temporal.Instant.from("2026-10-22T02:00:00Z");

function aPasskey(signCount: number) {
  return Passkeys.register(
    {
      accountId: accountIdSchema.parse("019a0000-0000-7000-8000-000000000001"),
      credentialId: credentialIdSchema.parse("AAAA"),
      publicKey: "key",
      algorithm: -7,
      signCount,
      transports: ["internal"],
      aaguid: "00000000-0000-0000-0000-000000000000",
      backupEligible: true,
      backedUp: false,
      name: deviceLabelSchema.parse("Chrome trên Android"),
    },
    createdAt,
  );
}

describe("Passkeys.recordUse", () => {
  it.each([
    [0, 0, false, 0],
    [0, 4, false, 4],
    [4, 5, false, 5],
    [5, 5, true, 5],
    [5, 3, true, 5],
  ])(
    "given a stored counter of %i and a response counter of %i, when used, then stalled is %s and %i is kept",
    (stored, presented, stalled, kept) => {
      const used = Passkeys.recordUse(
        aPasskey(stored),
        { signCount: presented, backedUp: true },
        usedAt,
      );

      expect(used.counterStalled).toBe(stalled);
      expect(used.passkey.signCount).toBe(kept);
    },
  );

  it("given a use, when recorded, then the backup state and the time move and nothing else does", () => {
    const passkey = aPasskey(0);

    const used = Passkeys.recordUse(passkey, { signCount: 0, backedUp: true }, usedAt);

    expect(used.passkey).toEqual({ ...passkey, backedUp: true, lastUsedAt: usedAt });
  });
});

describe("Passkeys.isPasskeyAlgorithm", () => {
  it.each([
    [-7, true],
    [-8, true],
    [-257, false],
    [-48, false],
    [-35, false],
  ])("given COSE algorithm %i, when checked, then it is offered: %s", (algorithm, offered) => {
    expect(Passkeys.isPasskeyAlgorithm(algorithm)).toBe(offered);
  });
});
