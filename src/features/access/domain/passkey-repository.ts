import type { AccountId } from "@/shared/domain/account-id";

import type { CredentialId, Passkey } from "./passkey";

// Reads only. Writes go through the application's unit of work.
export type PasskeyRepository = {
  findByCredentialId(credentialId: CredentialId): Promise<Passkey | undefined>;
  listForAccount(accountId: AccountId): Promise<ReadonlyArray<Passkey>>;
  // Everyone's, oldest first: Settings reads them once, not once per person
  list(): Promise<ReadonlyArray<Passkey>>;
};
