import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import {
  lastSeenPrecision,
  sessionIdleLimit,
  sessionLifetime,
  stepUpWindow,
} from "./access-policy";
import type { PasskeyId } from "./passkey";
import type { SecretHash } from "./secret";

// Read as a module: `import * as Sessions` then `Sessions.open(...)`

export const sessionIdSchema = z.uuid().brand<"SessionId">();

export type SessionId = z.infer<typeof sessionIdSchema>;

export const authenticationMethods = ["passkey", "password"] as const;

export type AuthenticationMethod = (typeof authenticationMethods)[number];

export const deviceLabelMaxLength = 100;

// How the device list names a device, for example "Chrome trên Android"
export const deviceLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(deviceLabelMaxLength)
  .brand<"DeviceLabel">();

export type DeviceLabel = z.infer<typeof deviceLabelSchema>;

// One signed-in device. The cookie carries the id and a secret; only the secret's hash is kept here.
export type Session = {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly verifier: SecretHash;
  readonly method: AuthenticationMethod;
  // Which passkey signed in; undefined for a password, or once that passkey is removed
  readonly passkeyId: PasskeyId | undefined;
  readonly authenticatedAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  readonly lastSeenAt: Temporal.Instant;
  readonly deviceLabel: DeviceLabel;
};

export type NewSession = Pick<
  Session,
  "accountId" | "verifier" | "method" | "passkeyId" | "deviceLabel"
>;

// A session exists only because someone just authenticated, so it starts at that moment (NIST 800-63B-4, 5.1)
export function open(details: NewSession, now: Temporal.Instant): Session {
  return {
    id: sessionIdSchema.parse(uuidv7()),
    ...details,
    authenticatedAt: now,
    expiresAt: now.add(sessionLifetime),
    lastSeenAt: now,
  };
}

// Over: 30 days after its sign-in, or 14 days after it was last seen, whichever comes first
export function isExpired(session: Session, now: Temporal.Instant): boolean {
  return (
    Temporal.Instant.compare(now, session.expiresAt) >= 0 ||
    Temporal.Instant.compare(now, session.lastSeenAt.add(sessionIdleLimit)) >= 0
  );
}

// Security settings ask for a recent authentication, not just a valid session
export function isFresh(session: Session, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, session.authenticatedAt.add(stepUpWindow)) < 0;
}

// Recent, and with the strongest way in the account has: on an account with a passkey, a password opens the book but
// never its security settings, so a phished password cannot add another passkey (ADR 0009, amended 2026-10-26)
export function isSteppedUp(
  session: Session,
  now: Temporal.Instant,
  accountHasPasskey: boolean,
): boolean {
  return isFresh(session, now) && (session.method === "passkey" || !accountHasPasskey);
}

export function isSeenLongAgo(session: Session, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, session.lastSeenAt.add(lastSeenPrecision)) >= 0;
}

// Only the device list's "last used" moves; the session still ends when it was going to
export function markSeen(session: Session, now: Temporal.Instant): Session {
  return { ...session, lastSeenAt: now };
}
