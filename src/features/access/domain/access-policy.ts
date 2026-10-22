import { Temporal } from "temporal-polyfill/implementation";

// The numbers behind sign-in, in one place. Reasons and sources: ADR 0009 in the project notes.

// NIST SP 800-63B-4 AAL1: reauthenticate at least every 30 days, counted from the sign-in, not from the last request
export const sessionLifetime = Temporal.Duration.from({ hours: 30 * 24 });

// last_seen_at is for the device list, so an hourly write is precise enough and spares D1
export const lastSeenPrecision = Temporal.Duration.from({ hours: 1 });

// Security settings need a sign-in this recent
export const stepUpWindow = Temporal.Duration.from({ minutes: 5 });

// ASVS 6.5.5 and NIST 3.1.3.2: an out-of-band secret lives at most 10 minutes
export const setupLinkLifetime = Temporal.Duration.from({ minutes: 10 });

// Long enough to read a prompt and find the phone's passkey, short enough that a stale page has to start over
export const ceremonyLifetime = Temporal.Duration.from({ minutes: 5 });

// 256 bits for every secret a browser holds: session secrets, setup tokens, ceremony bindings
export const secretByteLength = 32;

// Setup tokens are unguessable; this only stops one address from hammering the endpoint (ASVS 6.6.3)
export const setupLinkAttempts = {
  limit: 10,
  window: Temporal.Duration.from({ minutes: 10 }),
} as const;

// A passkey cannot be guessed either. Every sign-in screen asks for a prompt before the tap (Safari needs it ready),
// so this is loose enough for reloads and only caps the rows one address can make.
export const passkeySignInAttempts = {
  limit: 30,
  window: Temporal.Duration.from({ minutes: 10 }),
} as const;
