import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { deadJobsQueue, jobsQueue } from "./job-queues";

describe("the queues' names", () => {
  it("given the names cloudflare.config.ts declares, when compared, then the Worker routes on the same", () => {
    // Passed by vitest.config.ts, which reads the config in Node
    expect(Reflect.get(env, "CONFIG_JOBS_QUEUE")).toBe(jobsQueue);
    expect(Reflect.get(env, "CONFIG_DEAD_JOBS_QUEUE")).toBe(deadJobsQueue);
  });
});
