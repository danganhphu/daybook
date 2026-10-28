import { env } from "cloudflare:workers";

import { createJobs } from "@/composition/jobs";
import type {
  JobSender,
  NotificationJob,
} from "@/features/notifications/application/notification-job";
import type {
  PushDelivery,
  PushMessage,
  PushOutcome,
  PushSender,
} from "@/features/notifications/application/push-sender";
import type { SubscribeDeviceInput } from "@/features/notifications/application/subscribe-device";
import {
  pushEndpointSchema,
  pushKeysSchema,
  type PushSubscription,
} from "@/features/notifications/domain/push-subscription";
import type { Clock } from "@/shared/application/clock";

// Made up, in the shape a browser hands over: FCM's address with a random token, keys of the right lengths
export function browserSubscription(token = crypto.randomUUID()): SubscribeDeviceInput {
  return {
    endpoint: pushEndpointSchema.parse(`https://fcm.googleapis.com/fcm/send/${token}`),
    keys: pushKeysSchema.parse({ p256dh: `B${"A".repeat(86)}`, auth: "C".repeat(22) }),
  };
}

export type SentPush = {
  readonly to: PushSubscription;
  readonly message: PushMessage;
  readonly delivery: PushDelivery;
};

// Stands in for the push services: records what it is asked to send and answers as told, "sent" by default
export function recordingPushSender(answer: (to: PushSubscription) => PushOutcome = () => sent) {
  const sentPushes: SentPush[] = [];
  const sender: PushSender = {
    async send(to, message, delivery) {
      sentPushes.push({ to, message, delivery });
      return answer(to);
    },
  };

  return { sender, sent: sentPushes };
}

const sent: PushOutcome = { kind: "sent" };

// Stands in for the queue: keeps what was sent to it
export function recordingJobSender() {
  const queued: NotificationJob[] = [];
  const jobs: JobSender = {
    async send(batch) {
      queued.push(...batch);
    },
  };

  return { jobs, queued };
}

// The scheduler and the consumer over the test's D1, with a fake queue and push service
export function testJobs(clock: Clock, pushSender: PushSender | undefined) {
  const queue = recordingJobSender();

  return {
    ...createJobs({ db: env.DB, jobs: queue.jobs, pushSender }, clock),
    queued: queue.queued,
  };
}
