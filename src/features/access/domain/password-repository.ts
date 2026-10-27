import type { AccountId } from "@/shared/domain/account-id";

import type { Account, Username } from "./account";
import type { Password } from "./password";

// Reads only. Writes go through the application's unit of work.
export type PasswordRepository = {
  get(accountId: AccountId): Promise<Password | undefined>;
  // Everyone's: Settings reads them once, not once per person
  list(): Promise<ReadonlyArray<Password>>;
  // One query whatever the answer, so a username that exists takes no longer to look up than one that does not
  findForUsername(
    username: Username,
  ): Promise<{ readonly account: Account; readonly password: Password | undefined } | undefined>;
};
