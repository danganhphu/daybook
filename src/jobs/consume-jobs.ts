import type { createJobs } from "@/composition/jobs";
import { errorLines } from "@/shared/infrastructure/error-lines";

import { jobMessageSchema } from "./job-message";

type Jobs = Pick<ReturnType<typeof createJobs>, "deliver">;

// Exponential, from half a minute to an hour, when a send gives no time of its own
const firstRetrySeconds = 30;
const lastRetrySeconds = 3600;

export function retryDelay(attempts: number): number {
  return Math.min(firstRetrySeconds * 2 ** Math.max(0, attempts - 1), lastRetrySeconds);
}

async function consume(jobs: Jobs, message: Message): Promise<void> {
  const job = jobMessageSchema.safeParse(message.body);
  if (!job.success) {
    // Retrying cannot make it readable
    console.error(JSON.stringify({ event: "job_unreadable", id: message.id }));
    message.ack();
    return;
  }

  try {
    const outcome = await jobs.deliver(job.data);
    if (outcome.kind === "retry") {
      message.retry({ delaySeconds: outcome.afterSeconds ?? retryDelay(message.attempts) });
    } else {
      message.ack();
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "job_failed",
        kind: job.data.kind,
        attempts: message.attempts,
        errors: errorLines(error),
      }),
    );
    message.retry({ delaySeconds: retryDelay(message.attempts) });
  }
}

// The queue's consumer. Each message is acknowledged or retried on its own, so one that fails never sends the others
// again; after the queue's last retry it waits in the dead-letter queue.
export async function consumeJobs(jobs: Jobs, batch: MessageBatch): Promise<void> {
  await Promise.all(batch.messages.map((message) => consume(jobs, message)));
}
