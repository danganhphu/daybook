import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";

import { secretHashSchema } from "./secret";
import * as Sessions from "./session";

const signedIn = Temporal.Instant.from("2026-10-21T01:00:00Z");
const verifier = secretHashSchema.parse("A".repeat(43));

function aSession() {
  return Sessions.open(
    {
      accountId: accountIdSchema.parse("019a0000-0000-7000-8000-000000000001"),
      verifier,
      method: "passkey",
      passkeyId: undefined,
      deviceLabel: Sessions.deviceLabelSchema.parse("Chrome trên Android"),
    },
    signedIn,
  );
}

function after(instant: Temporal.Instant, duration: Temporal.DurationLike) {
  return instant.add(duration);
}

describe("Sessions.open", () => {
  it("given a sign-in, when a session opens, then it ends exactly 30 days later and was last seen at the sign-in", () => {
    const session = aSession();

    expect(session.authenticatedAt).toBe(signedIn);
    expect(session.expiresAt.toString()).toBe("2026-11-20T01:00:00Z");
    expect(session.lastSeenAt).toBe(signedIn);
  });
});

describe("Sessions.isExpired", () => {
  it("given a session, when one millisecond is left, then it has not expired", () => {
    const session = aSession();

    expect(Sessions.isExpired(session, session.expiresAt.subtract({ milliseconds: 1 }))).toBe(
      false,
    );
  });

  it("given a session, when its end is reached, then it has expired", () => {
    const session = aSession();

    expect(Sessions.isExpired(session, session.expiresAt)).toBe(true);
  });

  it("given a session used every day, when 30 days pass, then it still expires - the lifetime does not slide", () => {
    let session = aSession();
    for (let day = 1; day < 30; day += 1) {
      session = Sessions.markSeen(session, after(signedIn, { hours: day * 24 }));
    }

    expect(Sessions.isExpired(session, after(signedIn, { hours: 30 * 24 }))).toBe(true);
  });
});

describe("Sessions.isFresh", () => {
  it("given a sign-in under 5 minutes ago, when asked, then the session is fresh enough for security settings", () => {
    const session = aSession();

    expect(Sessions.isFresh(session, after(signedIn, { minutes: 4, seconds: 59 }))).toBe(true);
  });

  it("given a sign-in exactly 5 minutes ago, when asked, then it is no longer fresh", () => {
    const session = aSession();

    expect(Sessions.isFresh(session, after(signedIn, { minutes: 5 }))).toBe(false);
  });
});

describe("Sessions.isSeenLongAgo", () => {
  it("given a session seen under an hour ago, when used again, then there is nothing to record", () => {
    const session = aSession();

    expect(Sessions.isSeenLongAgo(session, after(signedIn, { minutes: 59 }))).toBe(false);
  });

  it("given a session seen an hour ago, when used again, then the new time is worth recording", () => {
    const session = aSession();

    expect(Sessions.isSeenLongAgo(session, after(signedIn, { hours: 1 }))).toBe(true);
  });

  it("given a session, when marked seen, then only lastSeenAt moves", () => {
    const session = aSession();
    const later = after(signedIn, { hours: 3 });

    const seen = Sessions.markSeen(session, later);

    expect(seen.lastSeenAt).toBe(later);
    expect(seen.authenticatedAt).toBe(session.authenticatedAt);
    expect(seen.expiresAt).toBe(session.expiresAt);
  });
});
