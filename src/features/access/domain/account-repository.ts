import type { Account, AccountId, Username } from "./account";

// Reads only. Writes go through the application's unit of work.
export type AccountRepository = {
  get(id: AccountId): Promise<Account | undefined>;
  findByUsername(username: Username): Promise<Account | undefined>;
  // Everyone who shares the book, oldest first: two people, so never paged
  list(): Promise<ReadonlyArray<Account>>;
};
