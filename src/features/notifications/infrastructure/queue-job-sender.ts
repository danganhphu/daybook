// A Queue takes at most 100 messages per sendBatch (Queues limits)
const messagesPerBatch = 100;

// Puts jobs on the queue: the notifications' and the bot's replies, which share it. What a job holds is checked when
// it comes off (jobMessageSchema).
export function createQueueJobSender(queue: Queue): {
  send(jobs: ReadonlyArray<object>): Promise<void>;
} {
  return {
    async send(jobs) {
      for (let start = 0; start < jobs.length; start += messagesPerBatch) {
        // oxlint-disable-next-line no-await-in-loop -- batches in order; two people rarely make more than one
        await queue.sendBatch(
          jobs.slice(start, start + messagesPerBatch).map((body) => ({ body })),
        );
      }
    },
  };
}
