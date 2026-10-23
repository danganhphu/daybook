import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import { lastSeenPrecision, sessionLifetime, stepUpWindow } from "./access-policy";
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

export function isExpired(session: Session, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, session.expiresAt) >= 0;
}

// Security settings ask for a recent authentication, not just a valid session
export function isFresh(session: Session, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, session.authenticatedAt.add(stepUpWindow)) < 0;
}

export function isSeenLongAgo(session: Session, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, session.lastSeenAt.add(lastSeenPrecision)) >= 0;
}

// Only the device list's "last used" moves; the session still ends when it was going to
export function markSeen(session: Session, now: Temporal.Instant): Session {
  return { ...session, lastSeenAt: now };
}
