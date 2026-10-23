import type { AccountId } from "@/shared/domain/account-id";
import type { Version } from "@/shared/domain/audit";

// What every change to an audited record carries: which record, who is changing it, and the version their screen
// showed, so a change from a stale screen is refused
export type RecordChange<Id> = {
  readonly id: Id;
  readonly by: AccountId;
  readonly shown: Version;
};
