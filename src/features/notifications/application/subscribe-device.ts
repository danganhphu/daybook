import type { AccessEventWrites } from "@/features/access/application/access-writes";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import * as PushSubscriptions from "@/features/notifications/domain/push-subscription";
import type { PushEndpoint, PushKeys } from "@/features/notifications/domain/push-subscription";
import type { PushSubscriptionRepository } from "@/features/notifications/domain/push-subscription-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NotificationError } from "./notification-errors";
import type { PushSubscriptionWrites } from "./notification-writes";

export type SubscribeDeviceDeps = {
  readonly clock: Clock;
  readonly pushAvailable: boolean;
  readonly subscriptions: PushSubscriptionRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly pushSubscriptions: PushSubscriptionWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type SubscribeDeviceInput = {
  readonly endpoint: PushEndpoint;
  readonly keys: PushKeys;
};

// This browser receives this person's notifications from now on, while this session lasts. Sent again after every
// sign-in or step-up on the same browser, which moves its subscription onto the new session.
export async function subscribeDevice(
  deps: SubscribeDeviceDeps,
  session: Session,
  input: SubscribeDeviceInput,
  origin: RequestOrigin,
): Promise<Result<null, Extract<NotificationError, "push_unavailable" | "push_service_unknown">>> {
  if (!deps.pushAvailable) {
    return err("push_unavailable");
  }
  if (!PushSubscriptions.isKnownPushService(input.endpoint)) {
    return err("push_service_unknown");
  }

  const now = deps.clock();
  const owner = {
    accountId: session.accountId,
    sessionId: session.id,
    deviceLabel: session.deviceLabel,
  };
  const [byEndpoint, bySession] = await Promise.all([
    deps.subscriptions.findByEndpoint(input.endpoint),
    deps.subscriptions.findBySession(session.id),
  ]);

  const work = deps.startUnitOfWork();
  // One per session: an address the browser has since replaced goes first
  if (bySession !== undefined && bySession.id !== byEndpoint?.id) {
    work.pushSubscriptions.remove(bySession.id);
  }
  if (byEndpoint === undefined) {
    work.pushSubscriptions.add(PushSubscriptions.create(owner, input.endpoint, input.keys, now));
  } else {
    work.pushSubscriptions.update(PushSubscriptions.rebind(byEndpoint, owner, input.keys));
  }
  // A device that starts receiving this account's notifications is an access fact; the same device after a new
  // sign-in, or with a renewed address, is not
  const newToAccount =
    byEndpoint === undefined ? bySession === undefined : byEndpoint.accountId !== session.accountId;
  if (newToAccount) {
    work.accessEvents.add(
      AccessEvents.record(
        "push_subscribed",
        { accountId: session.accountId, actorId: session.accountId, sessionId: session.id },
        origin,
        now,
      ),
    );
  }
  await work.commit();

  return ok(null);
}
