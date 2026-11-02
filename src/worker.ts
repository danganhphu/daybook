import web from "vinext/server/fetch-handler";

import { webhookPath } from "@/bot/webhook-path";
import { deadJobsQueue } from "@/jobs/job-queues";

// The Worker's ways in. vinext's handler is imported as vinext's own entry does: its build cannot split it into a
// chunk of its own (known-gaps). Telegram's webhook, the scheduler and the queues' consumers load their code on first
// use, so the web's requests never load it, and a bot message never reaches vinext or src/proxy.ts.
export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === webhookPath) {
      const [{ bot }, { handleWebhook }] = await Promise.all([
        import("@/composition/bot"),
        import("@/bot/webhook"),
      ]);
      const configured = bot();
      // No bot configured: the path is not there
      return configured === undefined
        ? new Response(null, { status: 404 })
        : handleWebhook(configured, request, (promise) => ctx.waitUntil(promise));
    }

    return web.fetch(request, env, ctx);
  },

  async scheduled(controller) {
    const [{ jobs }, { runSchedule }] = await Promise.all([
      import("@/composition/jobs"),
      import("@/jobs/run-schedule"),
    ]);
    await runSchedule(jobs, controller);
  },

  async queue(batch) {
    const { jobs } = await import("@/composition/jobs");
    if (batch.queue === deadJobsQueue) {
      const { consumeDeadJobs } = await import("@/jobs/consume-dead-jobs");
      await consumeDeadJobs(jobs(), batch);
      return;
    }
    const { consumeJobs } = await import("@/jobs/consume-jobs");
    await consumeJobs(jobs(), batch);
  },
} satisfies ExportedHandler<Env>;
