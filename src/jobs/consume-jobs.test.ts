import { describe, expect, it } from "vitest";

import type { DeliveryOutcome } from "@/features/notifications/application/deliver-notification";
import type { NotificationJob } from "@/features/notifications/application/notification-job";
import { anAuthorId } from "@/testing/support/app";

import { consumeJobs, retryDelay } from "./consume-jobs";

type Settled = { acked: boolean; retriedAfter: number | undefined };

// A queue message as the runtime hands one over, recording how it was settled
function aMessage(body: unknown, attempts = 1) {
  const settled: Settled = { acked: false, retriedAfter: undefined };
  const message: Message = {
    id: crypto.randomUUID(),
    timestamp: new Date("2026-10-29T00:30:00Z"),
    body,
    attempts,
    ack() {
      settled.acked = true;
    },
    retry(options) {
      settled.retriedAfter = options?.delaySeconds;
    },
  };

  return { message, settled };
}

function batchOf(...messages: ReadonlyArray<Message>): MessageBatch {
  return {
    queue: "jobs",
    messages,
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackAll() {},
    retryAll() {},
  };
}

const morning: NotificationJob = {
  kind: "digest",
  digest: "morning",
  accountId: anAuthorId,
  day: "2026-10-29",
};

function delivering(outcome: () => Promise<DeliveryOutcome>) {
  const delivered: NotificationJob[] = [];

  return {
    delivered,
    jobs: {
      async deliver(job: NotificationJob) {
        delivered.push(job);
        return outcome();
      },
    },
  };
}

describe("consumeJobs", () => {
  it("given a job, when it is delivered, then the message is acknowledged", async () => {
    const { message, settled } = aMessage(morning);
    const consumer = delivering(async () => ({ kind: "done" }));

    await consumeJobs(consumer.jobs, batchOf(message));

    expect(consumer.delivered).toEqual([morning]);
    expect(settled).toEqual({ acked: true, retriedAfter: undefined });
  });

  it("given a message no job reads from, when consumed, then it is acknowledged and nothing is delivered", async () => {
    const { message, settled } = aMessage({ kind: "digest", accountId: "not an id" });
    const consumer = delivering(async () => ({ kind: "done" }));

    await consumeJobs(consumer.jobs, batchOf(message));

    expect(consumer.delivered).toEqual([]);
    expect(settled.acked).toBe(true);
  });

  it("given a push service that named its wait, when the job asks again, then the message is retried after it", async () => {
    const { message, settled } = aMessage(morning);

    await consumeJobs(
      delivering(async () => ({ kind: "retry", afterSeconds: 90 })).jobs,
      batchOf(message),
    );

    expect(settled).toEqual({ acked: false, retriedAfter: 90 });
  });

  it("given a fault on the third attempt, when consumed, then it is retried later than the first time", async () => {
    const { message, settled } = aMessage(morning, 3);

    await consumeJobs(
      delivering(async () => {
        throw new Error("D1 unavailable");
      }).jobs,
      batchOf(message),
    );

    expect(settled.acked).toBe(false);
    expect(settled.retriedAfter).toBe(retryDelay(3));
    expect(retryDelay(3)).toBeGreaterThan(retryDelay(1));
  });

  it("given many attempts, when the wait is worked out, then it stops growing at an hour", () => {
    expect(retryDelay(1)).toBe(30);
    expect(retryDelay(30)).toBe(3600);
  });
});
