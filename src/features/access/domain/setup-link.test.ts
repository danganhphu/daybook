import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";
import { expectOk } from "@/testing/support/result";

import { secretHashSchema } from "./secret";
import * as SetupLinks from "./setup-link";

const issued = Temporal.Instant.from("2026-10-21T01:00:00Z");
const tokenHash = secretHashSchema.parse("B".repeat(43));
const owner = accountIdSchema.parse("019a0000-0000-7000-8000-000000000001");

function aFirstSetupLink() {
  return SetupLinks.issue({ purpose: "first_setup", accountId: owner, tokenHash }, issued);
}

describe("SetupLinks.issue", () => {
  it("given a first-setup link, when issued, then it is pending, names its account and lasts 10 minutes", () => {
    const link = aFirstSetupLink();

    expect(link.status).toBe("pending");
    expect(link.accountId).toBe(owner);
    expect(link.createdBy).toBeUndefined();
    expect(link.expiresAt.toString()).toBe("2026-10-21T01:10:00Z");
  });

  it("given an invite, when issued, then it has no account yet and records who made it", () => {
    const link = SetupLinks.issue({ purpose: "invite", createdBy: owner, tokenHash }, issued);

    expect(link.accountId).toBeUndefined();
    expect(link.createdBy).toBe(owner);
  });
});

describe("SetupLinks.redeem", () => {
  it("given a pending link, when redeemed before it expires, then it is redeemed at that time", () => {
    const now = issued.add({ minutes: 9, seconds: 59 });

    const redeemed = expectOk(SetupLinks.redeem(aFirstSetupLink(), now));

    expect(redeemed.status).toBe("redeemed");
    expect(redeemed.redeemedAt).toBe(now);
  });

  it("given a pending link, when redeemed exactly 10 minutes after issue, then it is refused", () => {
    expect(SetupLinks.redeem(aFirstSetupLink(), issued.add({ minutes: 10 }))).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });

  it("given a redeemed link, when redeemed again, then it is refused", () => {
    const redeemed = expectOk(SetupLinks.redeem(aFirstSetupLink(), issued.add({ minutes: 1 })));

    expect(SetupLinks.redeem(redeemed, issued.add({ minutes: 2 }))).toEqual({
      ok: false,
      error: "setup_link_unusable",
    });
  });
});
