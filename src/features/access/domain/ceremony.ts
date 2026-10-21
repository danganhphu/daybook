import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { setupLinkLifetime } from "./access-policy";
import type { AccountId } from "./account";
import type { SecretHash } from "./secret";
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

// A step a browser is part-way through. It belongs to that browser alone: the browser holds a cookie whose hash
// is the binding, so a ceremony started elsewhere cannot be finished here (ASVS 6.6.2). Used once, then deleted.
export type Ceremony = {
  readonly id: CeremonyId;
  readonly kind: CeremonyKind;
  readonly bindingHash: SecretHash;
  readonly accountId: AccountId | undefined;
  readonly setupLinkId: SetupLinkId | undefined;
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
    createdAt: now,
    expiresAt: now.add(setupLinkLifetime),
  };
}

export function isExpired(ceremony: Ceremony, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, ceremony.expiresAt) >= 0;
}
