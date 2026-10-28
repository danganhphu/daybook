import web from "vinext/server/fetch-handler";

// The Worker's three ways in. vinext's handler is imported as vinext's own entry does: its build cannot split it into a
// chunk of its own (known-gaps). The scheduler and the queue's consumer load their code on first use, so the web's
// requests never load it.
export default {
  fetch(request, env, ctx) {
    return web.fetch(request, env, ctx);
  },

  async scheduled(controller) {
    const [{ jobs }, { runSchedule }] = await Promise.all([
      import("@/composition/jobs"),
      import("@/jobs/run-schedule"),
    ]);
    await runSchedule(jobs(), controller);
  },

  async queue(batch) {
    const [{ jobs }, { consumeJobs }] = await Promise.all([
      import("@/composition/jobs"),
      import("@/jobs/consume-jobs"),
    ]);
    await consumeJobs(jobs(), batch);
  },
} satisfies ExportedHandler<Env>;
