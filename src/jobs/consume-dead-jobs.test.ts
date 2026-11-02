import { describe, expect, it } from "vitest";

import type { ReplyJob } from "@/bot/reply-job";
import { noteIdSchema } from "@/features/notes/domain/note";
import { anAuthorId } from "@/testing/support/app";
import { aQueueMessage, batchOf } from "@/testing/support/queue";

import { consumeDeadJobs } from "./consume-dead-jobs";
import { deadJobsQueue } from "./job-queues";

const reply: ReplyJob = {
  kind: "reply",
  accountId: anAuthorId,
  noteId: noteIdSchema.parse("019a0000-0000-7000-8000-0000000000f1"),
  chatId: 70_000_001,
  messageId: 42,
  again: false,
};

function reporting(fails = false) {
  const reported: ReplyJob[] = [];

  return {
    reported,
    jobs: {
      async reportUnanswered(job: ReplyJob) {
        if (fails) {
          throw new Error("D1 unavailable");
        }
        reported.push(job);
      },
    },
  };
}

describe("consumeDeadJobs", () => {
  it("given a reply that failed every retry, when it reaches the dead-letter queue, then its sender is told and it is let go", async () => {
    const { message, settled } = aQueueMessage(reply, 4);
    const dead = reporting();

    await consumeDeadJobs(dead.jobs, batchOf(deadJobsQueue, message));

    expect(dead.reported).toEqual([reply]);
    expect(settled).toEqual({ acked: true, retriedAfter: undefined, retried: false });
  });

  it.each([
    [
      "a notification",
      { kind: "digest", digest: "morning", accountId: anAuthorId, day: "2026-10-29" },
    ],
    ["a message no job reads from", { kind: "reply", accountId: "not an id" }],
  ])(
    "given %s, when it reaches the dead-letter queue, then it is let go and nobody is told",
    async (_, body) => {
      const { message, settled } = aQueueMessage(body, 4);
      const dead = reporting();

      await consumeDeadJobs(dead.jobs, batchOf(deadJobsQueue, message));

      expect(dead.reported).toEqual([]);
      expect(settled.acked).toBe(true);
    },
  );

  it("given telling the sender fails, when consumed, then the message is tried again", async () => {
    const { message, settled } = aQueueMessage(reply, 4);

    await consumeDeadJobs(reporting(true).jobs, batchOf(deadJobsQueue, message));

    expect(settled).toEqual({ acked: false, retriedAfter: undefined, retried: true });
  });
});
