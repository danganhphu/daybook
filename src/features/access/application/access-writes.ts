import type { Temporal } from "temporal-polyfill/implementation";

import type { AccessEvent } from "@/features/access/domain/access-event";
import type { Account, AccountId } from "@/features/access/domain/account";
import type { Ceremony, CeremonyId, Challenge } from "@/features/access/domain/ceremony";
import type { Passkey } from "@/features/access/domain/passkey";
import type { Session, SessionId } from "@/features/access/domain/session";
import type { PendingSetupLink, RedeemedSetupLink } from "@/features/access/domain/setup-link";

// What the access feature writes, store by store. Each queues on the current unit of work; nothing is stored until
// it commits.

export type AccountWrites = {
  add(account: Account): void;
};

export type PasskeyWrites = {
  add(passkey: Passkey): void;
  // The counter, the backup flag and the last use move; the key never does
  recordUse(passkey: Passkey): void;
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
  setChallenge(id: CeremonyId, challenge: Challenge): void;
  remove(id: CeremonyId): void;
  // Ceremonies abandoned part-way are swept whenever a new one starts
  removeExpired(now: Temporal.Instant): void;
};

export type AccessEventWrites = {
  add(event: AccessEvent): void;
};
