import * as Sessions from "@/features/access/domain/session";
import type {
  ChannelOutcome,
  NotificationChannel,
} from "@/features/notifications/application/notification-channel";
import type { PushSubscriptionWrites } from "@/features/notifications/application/notification-writes";
import type { PushSender } from "@/features/notifications/application/push-sender";
import * as PushSubscriptions from "@/features/notifications/domain/push-subscription";
import type { PushSubscriptionRepository } from "@/features/notifications/domain/push-subscription-repository";
import { pushMessageFor } from "@/features/notifications/web/push-text";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

export type PushChannelDeps = {
  readonly clock: Clock;
  readonly subscriptions: PushSubscriptionRepository;
  readonly sender: PushSender;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly pushSubscriptions: PushSubscriptionWrites;
  }>;
};

// The web's own way to speak first: every browser of this person's that is signed in and turned it on
export function createPushChannel(deps: PushChannelDeps): NotificationChannel {
  return {
    name: "push",

    async send(accountId, content, ref): Promise<ChannelOutcome> {
      const now = deps.clock();
      const devices = (await deps.subscriptions.listWithSessions(accountId))
        .filter(({ session }) => !Sessions.isExpired(session, now))
        .map(({ subscription }) => subscription);
      if (devices.length === 0) {
        return { kind: "unreachable" };
      }

      const { message, delivery } = pushMessageFor(content, ref);
      const results = await Promise.all(
        devices.map(async (subscription) => ({
          subscription,
          outcome: await deps.sender.send(subscription, message, delivery),
        })),
      );

      const work = deps.startUnitOfWork();
      let reached = 0;
      let retry: ChannelOutcome | undefined;
      for (const { subscription, outcome } of results) {
        switch (outcome.kind) {
          case "sent":
            reached += 1;
            work.pushSubscriptions.update(PushSubscriptions.markSent(subscription, now));
            break;
          case "gone":
            work.pushSubscriptions.remove(subscription.id);
            break;
          case "retry":
            retry = { kind: "retry", afterSeconds: outcome.afterSeconds };
            break;
          case "refused":
            // The host only: the rest of the address is the browser's capability
            console.error(
              JSON.stringify({
                event: "push_refused",
                status: outcome.status,
                host: new URL(subscription.endpoint).host,
              }),
            );
            break;
          default:
            outcome satisfies never;
        }
      }
      await work.commit();

      // A browser that got it while another did not gets it again with the retry; its tag replaces the first
      return retry ?? (reached > 0 ? { kind: "sent" } : { kind: "unreachable" });
    },
  };
}
