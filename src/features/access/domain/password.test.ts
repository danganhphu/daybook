import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";

import { passwordLockAfter } from "./access-policy";
import * as Passwords from "./password";
import { passwordSaltSchema, passwordVerifierSchema } from "./password";

const setAt = Temporal.Instant.from("2026-10-22T01:00:00Z");
const failedAt = Temporal.Instant.from("2026-10-22T02:00:00Z");

function aPassword() {
  return Passwords.set(
    {
      accountId: accountIdSchema.parse("019a0000-0000-7000-8000-000000000001"),
      salt: passwordSaltSchema.parse("S".repeat(22)),
      parameters: Passwords.currentArgon2Parameters,
      verifier: passwordVerifierSchema.parse("V".repeat(43)),
      pepperVersion: 1,
    },
    setAt,
  );
}

function failedTimes(times: number) {
  let password = aPassword();
  for (let failure = 0; failure < times; failure += 1) {
    password = Passwords.recordFailure(password, failedAt);
  }

  return password;
}

describe("Passwords.set", () => {
  it("given new details, when set, then the password starts with no failures and unlocked", () => {
    expect(aPassword()).toMatchObject({
      consecutiveFailures: 0,
      lockedAt: undefined,
      changedAt: setAt,
    });
  });
});

describe("Passwords.recordFailure", () => {
  it("given one failure short of the limit, when it fails, then it is still unlocked", () => {
    expect(Passwords.isLocked(failedTimes(passwordLockAfter - 1))).toBe(false);
  });

  it("given the hundredth failure in a row, when it fails, then it locks at that moment", () => {
    const locked = failedTimes(passwordLockAfter);

    expect(locked.consecutiveFailures).toBe(100);
    expect(locked.lockedAt).toEqual(failedAt);
  });

  it("given a locked password, when it fails again, then it stays locked from the first time", () => {
    const later = Temporal.Instant.from("2026-10-22T03:00:00Z");

    expect(Passwords.recordFailure(failedTimes(passwordLockAfter), later).lockedAt).toEqual(
      failedAt,
    );
  });
});

describe("Passwords.recordSuccess", () => {
  it("given earlier failures, when the password is right, then the count starts again", () => {
    expect(Passwords.recordSuccess(failedTimes(7)).consecutiveFailures).toBe(0);
  });
});
