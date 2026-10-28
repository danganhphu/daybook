import type {
  JobSender,
  NotificationJob,
} from "@/features/notifications/application/notification-job";

// A Queue takes at most 100 messages per sendBatch (Queues limits)
const messagesPerBatch = 100;

export function createQueueJobSender(queue: Queue): JobSender {
  return {
    async send(jobs: ReadonlyArray<NotificationJob>) {
      for (let start = 0; start < jobs.length; start += messagesPerBatch) {
        // oxlint-disable-next-line no-await-in-loop -- batches in order; two people rarely make more than one
        await queue.sendBatch(
          jobs.slice(start, start + messagesPerBatch).map((body) => ({ body })),
        );
      }
    },
  };
}
