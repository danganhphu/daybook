import type { DeliveryKey } from "@/features/notifications/domain/delivery";
import type { Clock } from "@/shared/application/clock";

import { composeContent, type ContentSources } from "./compose-content";
import type { DeliveryLedger } from "./delivery-ledger";
import type { NotificationChannel } from "./notification-channel";
import type { NotificationContent } from "./notification-content";
import type { NotificationJob } from "./notification-job";

export type DeliverNotificationDeps = ContentSources & {
  readonly clock: Clock;
  readonly ledger: DeliveryLedger;
  // Every way this book can reach a person; a channel that cannot reach this one says so
  readonly channels: ReadonlyArray<NotificationChannel>;
};

export type DeliveryOutcome =
  | { readonly kind: "done" }
  | { readonly kind: "retry"; readonly afterSeconds: number | undefined };

const done: DeliveryOutcome = { kind: "done" };

function together(outcomes: ReadonlyArray<DeliveryOutcome>): DeliveryOutcome {
  return outcomes.reduce<DeliveryOutcome>((all, outcome) => {
    if (outcome.kind === "done") {
      return all;
    }
    if (all.kind === "done" || all.afterSeconds === undefined) {
      return outcome;
    }

    return outcome.afterSeconds === undefined
      ? all
      : { kind: "retry", afterSeconds: Math.max(all.afterSeconds, outcome.afterSeconds) };
  }, done);
}

// The queue's consumer: one job, on every channel the ledger lets it claim. A channel that is done is never sent to
// again; one that failed is retried with the job, while the others stay done.
export async function deliverNotification(
  deps: DeliverNotificationDeps,
  job: NotificationJob,
): Promise<DeliveryOutcome> {
  const subject = job.kind === "digest" ? job.digest : "notice";
  const ref = job.kind === "digest" ? job.day : job.eventId;
  // Read once, for whichever channels claim the job
  let composed: Promise<NotificationContent | undefined> | undefined;

  async function deliverOn(channel: NotificationChannel): Promise<DeliveryOutcome> {
    const key: DeliveryKey = { accountId: job.accountId, subject, ref, channel: channel.name };
    if (!(await deps.ledger.claim(key, deps.clock()))) {
      return done;
    }

    composed ??= composeContent(deps, job);
    const content = await composed;
    if (content === undefined) {
      await deps.ledger.finish(key, "skipped", deps.clock());
      return done;
    }

    const outcome = await channel.send(job.accountId, content, ref);
    switch (outcome.kind) {
      case "sent":
        await deps.ledger.finish(key, "sent", deps.clock());
        return done;
      case "unreachable":
        await deps.ledger.finish(key, "skipped", deps.clock());
        return done;
      case "retry":
        return { kind: "retry", afterSeconds: outcome.afterSeconds };
      default:
        return outcome satisfies never;
    }
  }

  return together(await Promise.all(deps.channels.map(deliverOn)));
}
