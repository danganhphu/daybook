import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import type { DeviceLabel } from "./session";

// Read as a module: `import * as Passkeys` then `Passkeys.register(...)`

export const passkeyIdSchema = z.uuid().brand<"PasskeyId">();

export type PasskeyId = z.infer<typeof passkeyIdSchema>;

// The authenticator's name for the credential, base64url. WebAuthn allows up to 1023 bytes.
export const credentialIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,1364}$/)
  .brand<"CredentialId">();

export type CredentialId = z.infer<typeof credentialIdSchema>;

// ES256, Ed25519 and RS256, the order registration offers them in. Anything else is never stored.
export const passkeyAlgorithms = [-7, -8, -257] as const;

export type PasskeyAlgorithm = (typeof passkeyAlgorithms)[number];

export function isPasskeyAlgorithm(value: number): value is PasskeyAlgorithm {
  return passkeyAlgorithms.some((algorithm) => algorithm === value);
}

// One way into one account: a key pair whose private half never leaves the user's device or password manager
export type Passkey = {
  readonly id: PasskeyId;
  readonly accountId: AccountId;
  readonly credentialId: CredentialId;
  // COSE-encoded, base64url
  readonly publicKey: string;
  readonly algorithm: PasskeyAlgorithm;
  readonly signCount: number;
  readonly transports: ReadonlyArray<string>;
  // Which kind of authenticator made it, for the passkey list; all zeros when the authenticator does not say
  readonly aaguid: string;
  // Synced passkeys are backup-eligible; a hardware key is not
  readonly backupEligible: boolean;
  readonly backedUp: boolean;
  // The device it was made on, until the user renames it
  readonly name: DeviceLabel;
  readonly createdAt: Temporal.Instant;
  readonly lastUsedAt: Temporal.Instant | undefined;
};

export type NewPasskey = Omit<Passkey, "id" | "createdAt" | "lastUsedAt">;

export function register(details: NewPasskey, now: Temporal.Instant): Passkey {
  return {
    id: passkeyIdSchema.parse(uuidv7()),
    ...details,
    createdAt: now,
    lastUsedAt: undefined,
  };
}

export type PasskeyUse = {
  readonly signCount: number;
  readonly backedUp: boolean;
};

export type RecordedUse = {
  readonly passkey: Passkey;
  // A counter that did not move forward can mean a cloned authenticator. Synced passkeys report 0 every time, so
  // this is a signal to record, never a reason to refuse (WebAuthn L3, 6.1.1; ADR 0009).
  readonly counterStalled: boolean;
};

export function recordUse(passkey: Passkey, use: PasskeyUse, now: Temporal.Instant): RecordedUse {
  const counterStalled =
    (passkey.signCount > 0 || use.signCount > 0) && use.signCount <= passkey.signCount;

  return {
    passkey: {
      ...passkey,
      signCount: Math.max(passkey.signCount, use.signCount),
      backedUp: use.backedUp,
      lastUsedAt: now,
    },
    counterStalled,
  };
}
