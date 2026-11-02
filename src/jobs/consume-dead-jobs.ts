import type { ReplyJob } from "@/bot/reply-job";
import { errorLines } from "@/shared/infrastructure/error-lines";
import { logEvent } from "@/shared/infrastructure/log-event";

import { jobMessageSchema } from "./job-message";

type DeadJobs = {
  readonly reportUnanswered: (job: ReplyJob) => Promise<void>;
};

// The dead-letter queue's consumer: jobs that failed every retry. Each leaves a line in Workers Logs; a message the
// bot never answered is also told to whoever sent it, in the bell. Then the job is let go, as trying again would fail
// the same way; the queue itself keeps it only 24 hours on the free plan.
export async function consumeDeadJobs(jobs: DeadJobs, batch: MessageBatch): Promise<void> {
  await Promise.all(
    batch.messages.map(async (message) => {
      const job = jobMessageSchema.safeParse(message.body);
      logEvent("job_dead", { kind: job.success ? job.data.kind : "unreadable", id: message.id });
      if (job.success && job.data.kind === "reply") {
        try {
          await jobs.reportUnanswered(job.data);
        } catch (error) {
          // Tried again by the dead-letter queue's own retries
          logEvent("job_dead_unreported", { errors: errorLines(error) });
          message.retry();
          return;
        }
      }
      message.ack();
    }),
  );
}
