export type Settled = { acked: boolean; retriedAfter: number | undefined; retried: boolean };

// A queue message as the runtime hands one over, recording how it was settled
export function aQueueMessage(body: unknown, attempts = 1) {
  const settled: Settled = { acked: false, retriedAfter: undefined, retried: false };
  const message: Message = {
    id: crypto.randomUUID(),
    timestamp: new Date("2026-10-29T00:30:00Z"),
    body,
    attempts,
    ack() {
      settled.acked = true;
    },
    retry(options) {
      settled.retried = true;
      settled.retriedAfter = options?.delaySeconds;
    },
  };

  return { message, settled };
}

export function batchOf(queue: string, ...messages: ReadonlyArray<Message>): MessageBatch {
  return {
    queue,
    messages,
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackAll() {},
    retryAll() {},
  };
}
