import type { AccessEvent } from "@/features/access/domain/access-event";
import type { Account, AccountId } from "@/features/access/domain/account";
import type { Ceremony, CeremonyId } from "@/features/access/domain/ceremony";
import type { Session, SessionId } from "@/features/access/domain/session";
import type { PendingSetupLink, RedeemedSetupLink } from "@/features/access/domain/setup-link";

// What the access feature writes, store by store. Each queues on the current unit of work; nothing is stored until
// it commits.

export type AccountWrites = {
  add(account: Account): void;
};

export type SessionWrites = {
  add(session: Session): void;
  markSeen(session: Session): void;
  remove(id: SessionId): void;
  removeAll(accountId: AccountId): void;
  removeAllExcept(accountId: AccountId, keep: SessionId): void;
};

export type SetupLinkWrites = {
  add(link: PendingSetupLink): void;
  markRedeemed(link: RedeemedSetupLink): void;
};

export type CeremonyWrites = {
  add(ceremony: Ceremony): void;
  remove(id: CeremonyId): void;
};

export type AccessEventWrites = {
  add(event: AccessEvent): void;
};
