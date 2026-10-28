import type { Session, SessionId } from "@/features/access/domain/session";
import type { AccountId } from "@/shared/domain/account-id";

import type { PushEndpoint, PushSubscription, PushSubscriptionId } from "./push-subscription";

// A subscription with the session it belongs to, so a caller can tell whether that session still runs
export type DeviceSubscription = {
  readonly subscription: PushSubscription;
  readonly session: Session;
};

// Reads only; writes go through the unit of work
export type PushSubscriptionRepository = {
  get(id: PushSubscriptionId): Promise<PushSubscription | undefined>;
  findByEndpoint(endpoint: PushEndpoint): Promise<PushSubscription | undefined>;
  findBySession(sessionId: SessionId): Promise<PushSubscription | undefined>;
  // Every one, or one account's, sessions that have run out included: the caller decides
  listWithSessions(accountId?: AccountId): Promise<ReadonlyArray<DeviceSubscription>>;
};
