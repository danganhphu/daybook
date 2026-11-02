// The numbers behind a password, apart from access-policy.ts's durations: the browser derives the key with them and
// must not load Temporal for it. Reasons and sources: ADR 0009 in the project notes.

// OWASP Password Storage cheat sheet, Argon2id's minimum: 19 MiB, 2 passes, 1 lane. The database refuses less.
export const argon2Minimum = { memoryKib: 19_456, iterations: 2, parallelism: 1 } as const;

// The cost new passwords get. Run in the browser (ADR 0009): the Worker's 10 ms of CPU could not afford it. Stored
// per password, so a later raise needs no migration.
export const argon2Parameters = argon2Minimum;

// Bytes of salt per password, and of the key Argon2id derives
export const passwordSaltByteLength = 16;
export const derivedKeyByteLength = 32;

// NIST SP 800-63B-4, 3.1.1.2: at least 15 characters for a password used alone; no composition rules. The upper
// bound only keeps a pasted novel from tying up the browser.
export const passwordLength = { minimum: 15, maximum: 128 } as const;

// NIST SP 800-63B-4, 3.2.2: no more than 100 consecutive failures; a locked password leaves passkeys working
export const passwordLockAfter = 100;
