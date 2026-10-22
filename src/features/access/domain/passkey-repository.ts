import type { AccountId } from "./account";
import type { CredentialId, Passkey } from "./passkey";

// Reads only. Writes go through the application's unit of work.
export type PasskeyRepository = {
  findByCredentialId(credentialId: CredentialId): Promise<Passkey | undefined>;
  listForAccount(accountId: AccountId): Promise<ReadonlyArray<Passkey>>;
};
