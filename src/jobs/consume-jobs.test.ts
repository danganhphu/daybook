import { describe, expect, it } from "vitest";

import type { DeliveryOutcome } from "@/features/notifications/application/deliver-notification";
import { anAuthorId } from "@/testing/support/app";
import { aQueueMessage, batchOf } from "@/testing/support/queue";

import { consumeJobs, retryDelay } from "./consume-jobs";
import type { Job } from "./job-message";
import { jobsQueue } from "./job-queues";

const morning: Job = {
  kind: "digest",
  digest: "morning",
  accountId: anAuthorId,
  day: "2026-10-29",
};

function delivering(outcome: () => Promise<DeliveryOutcome>) {
  const delivered: Job[] = [];

  return {
    delivered,
    jobs: {
      async deliver(job: Job) {
        delivered.push(job);
        return outcome();
      },
    },
  };
}

describe("consumeJobs", () => {
  it("given a job, when it is delivered, then the message is acknowledged", async () => {
    const { message, settled } = aQueueMessage(morning);
    const consumer = delivering(async () => ({ kind: "done" }));

    await consumeJobs(consumer.jobs, batchOf(jobsQueue, message));

    expect(consumer.delivered).toEqual([morning]);
    expect(settled).toEqual({ acked: true, retriedAfter: undefined, retried: false });
  });

  it("given a message no job reads from, when consumed, then it is acknowledged and nothing is delivered", async () => {
    const { message, settled } = aQueueMessage({ kind: "digest", accountId: "not an id" });
    const consumer = delivering(async () => ({ kind: "done" }));

    await consumeJobs(consumer.jobs, batchOf(jobsQueue, message));

    expect(consumer.delivered).toEqual([]);
    expect(settled.acked).toBe(true);
  });

  it("given a push service that named its wait, when the job asks again, then the message is retried after it", async () => {
    const { message, settled } = aQueueMessage(morning);

    await consumeJobs(
      delivering(async () => ({ kind: "retry", afterSeconds: 90 })).jobs,
      batchOf(jobsQueue, message),
    );

    expect(settled).toEqual({ acked: false, retriedAfter: 90, retried: true });
  });

  it("given a fault on the third attempt, when consumed, then it is retried later than the first time", async () => {
    const { message, settled } = aQueueMessage(morning, 3);

    await consumeJobs(
      delivering(async () => {
        throw new Error("D1 unavailable");
      }).jobs,
      batchOf(jobsQueue, message),
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
