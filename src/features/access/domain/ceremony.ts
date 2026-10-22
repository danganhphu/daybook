import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { ceremonyLifetime, setupLinkLifetime } from "./access-policy";
import type { AccountId } from "./account";
import type { PasswordSalt } from "./password";
import { randomValueSchema, type SecretHash } from "./secret";
import type { RedeemedSetupLink, SetupLinkId } from "./setup-link";

// Read as a module: `import * as Ceremonies` then `Ceremonies.startSetup(...)`

export const ceremonyIdSchema = z.uuid().brand<"CeremonyId">();

export type CeremonyId = z.infer<typeof ceremonyIdSchema>;

export const ceremonyKinds = [
  "setup",
  "passkey_registration",
  "passkey_sign_in",
  "password_sign_in",
  "password_change",
] as const;

export type CeremonyKind = (typeof ceremonyKinds)[number];

// What the authenticator signs, 32 random bytes in base64url (WebAuthn L3, 13.4.3 asks for at least 16). Not a
// secret - the page holds it - but good for one response only.
export const challengeSchema = randomValueSchema.brand<"Challenge">();

export type Challenge = z.infer<typeof challengeSchema>;

// A step a browser is part-way through. It belongs to that browser alone: the browser holds a cookie whose hash
// is the binding, so a ceremony started elsewhere cannot be finished here (ASVS 6.6.2). Deleted once finished.
export type Ceremony = {
  readonly id: CeremonyId;
  readonly kind: CeremonyKind;
  readonly bindingHash: SecretHash;
  readonly accountId: AccountId | undefined;
  readonly setupLinkId: SetupLinkId | undefined;
  // The challenge a passkey prompt is waiting on, if one is. A setup gets a new one for every attempt.
  readonly challenge: Challenge | undefined;
  // The salt handed to the browser for a new password, kept until the password it derives arrives
  readonly salt: PasswordSalt | undefined;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
};

// A redeemed setup link becomes a setup ceremony: as long as the link had, to create a passkey or fill in an invite
export function startSetup(
  link: RedeemedSetupLink,
  bindingHash: SecretHash,
  now: Temporal.Instant,
): Ceremony {
  return {
    id: ceremonyIdSchema.parse(uuidv7()),
    kind: "setup",
    bindingHash,
    accountId: link.accountId,
    setupLinkId: link.id,
    challenge: undefined,
    salt: undefined,
    createdAt: now,
    expiresAt: now.add(setupLinkLifetime),
  };
}

// A passkey prompt for signing in. With an account, it is a step-up: only that account's passkeys will do.
export function startPasskeySignIn(
  bindingHash: SecretHash,
  challenge: Challenge,
  accountId: AccountId | undefined,
  now: Temporal.Instant,
): Ceremony {
  return {
    id: ceremonyIdSchema.parse(uuidv7()),
    kind: "passkey_sign_in",
    bindingHash,
    accountId,
    setupLinkId: undefined,
    challenge,
    salt: undefined,
    createdAt: now,
    expiresAt: now.add(ceremonyLifetime),
  };
}

// Another passkey for an account already signed in, from its settings
export function startPasskeyRegistration(
  bindingHash: SecretHash,
  challenge: Challenge,
  accountId: AccountId,
  now: Temporal.Instant,
): Ceremony {
  return {
    id: ceremonyIdSchema.parse(uuidv7()),
    kind: "passkey_registration",
    bindingHash,
    accountId,
    setupLinkId: undefined,
    challenge,
    salt: undefined,
    createdAt: now,
    expiresAt: now.add(ceremonyLifetime),
  };
}

// A password sign-in under way. The account is undefined when the username matched nobody: the browser still gets a
// salt and still finishes, so whether a username exists is not something the answers tell apart.
export function startPasswordSignIn(
  bindingHash: SecretHash,
  accountId: AccountId | undefined,
  now: Temporal.Instant,
): Ceremony {
  return {
    id: ceremonyIdSchema.parse(uuidv7()),
    kind: "password_sign_in",
    bindingHash,
    accountId,
    setupLinkId: undefined,
    challenge: undefined,
    salt: undefined,
    createdAt: now,
    expiresAt: now.add(ceremonyLifetime),
  };
}

// A new password for a signed-in account: the salt is chosen here, so the browser cannot pick a weak one
export function startPasswordChange(
  bindingHash: SecretHash,
  accountId: AccountId,
  salt: PasswordSalt,
  now: Temporal.Instant,
): Ceremony {
  return {
    id: ceremonyIdSchema.parse(uuidv7()),
    kind: "password_change",
    bindingHash,
    accountId,
    setupLinkId: undefined,
    challenge: undefined,
    salt,
    createdAt: now,
    expiresAt: now.add(ceremonyLifetime),
  };
}

export function isExpired(ceremony: Ceremony, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, ceremony.expiresAt) >= 0;
}
