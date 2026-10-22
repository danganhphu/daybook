import type { DisplayName, Username, UserHandle } from "@/features/access/domain/account";
import type { Challenge } from "@/features/access/domain/ceremony";
import type {
  CredentialId,
  Passkey,
  PasskeyAlgorithm,
  PasskeyUse,
} from "@/features/access/domain/passkey";
import type { Result } from "@/shared/domain/result";

// WebAuthn as a port. The adapter knows the relying party (this app's origin and RP ID) and the library; use cases
// hand it challenges and stored passkeys and get back facts or a reason. Browser responses arrive as `unknown`:
// nothing from the page is trusted until the adapter has checked it.

export type CredentialDescriptor = {
  readonly id: CredentialId;
  readonly transports: ReadonlyArray<string>;
};

export type RegistrationPrompt = {
  readonly challenge: Challenge;
  readonly user: {
    readonly handle: UserHandle;
    readonly name: Username;
    readonly displayName: DisplayName;
  };
  // Passkeys the account already has, so the same authenticator is not registered twice
  readonly exclude: ReadonlyArray<CredentialDescriptor>;
};

export type SignInPrompt = {
  readonly challenge: Challenge;
  // Empty to let the browser offer any passkey for this site; a step-up lists the account's own
  readonly allow: ReadonlyArray<CredentialDescriptor>;
};

export type RegisteredCredential = {
  readonly credentialId: CredentialId;
  readonly publicKey: string;
  readonly algorithm: PasskeyAlgorithm;
  readonly signCount: number;
  readonly transports: ReadonlyArray<string>;
  readonly aaguid: string;
  readonly backupEligible: boolean;
  readonly backedUp: boolean;
};

// Who a sign-in response says it is, read before anything is verified, to find the stored passkey
export type PresentedAssertion = {
  readonly credentialId: CredentialId;
  readonly userHandle: UserHandle | undefined;
};

// Why a response was refused, for the access log only. Never shown, never a secret.
export type PasskeyRejection =
  | "malformed"
  | "type"
  | "challenge"
  | "origin"
  | "rp_id"
  | "user_presence"
  | "user_verification"
  | "algorithm"
  | "signature"
  | "other";

export type PasskeyVerifier = {
  creationOptions(prompt: RegistrationPrompt): Promise<PublicKeyCredentialCreationOptionsJSON>;
  requestOptions(prompt: SignInPrompt): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyRegistration(
    response: unknown,
    challenge: Challenge,
  ): Promise<Result<RegisteredCredential, PasskeyRejection>>;
  readAssertion(response: unknown): PresentedAssertion | undefined;
  verifyAssertion(
    response: unknown,
    challenge: Challenge,
    passkey: Passkey,
  ): Promise<Result<PasskeyUse, PasskeyRejection>>;
};
