import type { AccessEventWrites } from "@/features/access/application/access-writes";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import { pushSubscriptionIdSchema } from "@/features/notifications/domain/push-subscription";
import type { PushSubscriptionRepository } from "@/features/notifications/domain/push-subscription-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NotificationError } from "./notification-errors";
import type { PushSubscriptionWrites } from "./notification-writes";

export type UnsubscribeDeviceDeps = {
  readonly clock: Clock;
  readonly subscriptions: PushSubscriptionRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly pushSubscriptions: PushSubscriptionWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// One of this person's devices stops receiving notifications: this one, or another they no longer use
export async function unsubscribeDevice(
  deps: UnsubscribeDeviceDeps,
  session: Session,
  subscriptionId: unknown,
  origin: RequestOrigin,
): Promise<Result<null, Extract<NotificationError, "not_found">>> {
  const id = pushSubscriptionIdSchema.safeParse(subscriptionId);
  const found = id.success ? await deps.subscriptions.get(id.data) : undefined;
  if (found === undefined || found.accountId !== session.accountId) {
    return err("not_found");
  }

  const work = deps.startUnitOfWork();
  work.pushSubscriptions.remove(found.id);
  work.accessEvents.add(
    AccessEvents.record(
      "push_unsubscribed",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: found.sessionId,
        detail: { device: found.deviceLabel },
      },
      origin,
      deps.clock(),
    ),
  );
  await work.commit();

  return ok(null);
}
