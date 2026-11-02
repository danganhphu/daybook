import { Temporal } from "temporal-polyfill/implementation";

// The numbers behind sign-in, the server's side. Reasons and sources: ADR 0009 in the project notes.

// NIST SP 800-63B-4 AAL1: reauthenticate at least every 30 days, counted from the sign-in, not from the last request
export const sessionLifetime = Temporal.Duration.from({ hours: 30 * 24 });

// ASVS 7.3.1: a session left unused this long ends too, whatever is left of its 30 days. Two weeks off - Tet, say -
// costs one Face ID.
export const sessionIdleLimit = Temporal.Duration.from({ hours: 14 * 24 });

// last_seen_at feeds the device list and the idle limit; an hourly write is precise enough for both and spares D1
export const lastSeenPrecision = Temporal.Duration.from({ hours: 1 });

// Security settings need a sign-in this recent
export const stepUpWindow = Temporal.Duration.from({ minutes: 5 });

// ASVS 6.5.5 and NIST 3.1.3.2: an out-of-band secret lives at most 10 minutes
export const setupLinkLifetime = Temporal.Duration.from({ minutes: 10 });

// The code in a Telegram link is an out-of-band secret too, opened on the same phone a moment later
export const telegramLinkCodeLifetime = setupLinkLifetime;

// Long enough to read a prompt and find the phone's passkey, short enough that a stale page has to start over
export const ceremonyLifetime = Temporal.Duration.from({ minutes: 5 });

// 256 bits for every secret a browser holds: session secrets, setup tokens, ceremony bindings
export const secretByteLength = 32;

// SHA-256 and HMAC-SHA256 output: every hash and verifier the database keeps
export const digestByteLength = 32;

// PASSWORD_PEPPER, a key for HMAC-SHA256 as long as its output (RFC 2104, 3)
export const pepperByteLength = 32;

// Setup tokens are unguessable; this only stops one address from hammering the endpoint (ASVS 6.6.3)
export const setupLinkAttempts = {
  limit: 10,
  window: Temporal.Duration.from({ minutes: 10 }),
} as const;

// The same for a Telegram user sending link codes to the bot
export const telegramLinkAttempts = setupLinkAttempts;

// A password's own numbers are in password-policy.ts, which the browser loads

// Guessing a password is the one attack sign-in can be tried with, so it is limited twice: per client and per
// account. Sized so a person who mistypes a few times never meets them.
export const passwordSignInAttempts = {
  perClient: { limit: 20, window: Temporal.Duration.from({ minutes: 10 }) },
  perAccount: { limit: 10, window: Temporal.Duration.from({ minutes: 15 }) },
} as const;

// A passkey cannot be guessed either. Every sign-in screen asks for a prompt before the tap (Safari needs it ready),
// so this is loose enough for reloads and only caps the rows one address can make.
export const passkeySignInAttempts = {
  limit: 30,
  window: Temporal.Duration.from({ minutes: 10 }),
} as const;
