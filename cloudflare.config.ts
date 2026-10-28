import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

// The newest date the local workerd supports; raise it when the Cloudflare packages update.
// Shared with vitest.config.ts so tests run on the same runtime behaviour.
export const compatibilityDate = "2026-09-28";
export const compatibilityFlags = ["nodejs_compat"];

// Not a secret. `cf d1 migrations apply` needs it even for the local database.
export const databaseId = "f116c00d-1ef3-4841-831b-e821c5f8a29b";

// `vite dev` serves here; passkeys are bound to the exact origin, so the port must not drift
export const developmentOrigin = "http://localhost:5173";

// `vite build --mode e2e`: the build the end-to-end tests serve, which calls no model
export const endToEndMode = "e2e";

// Its own copy: the Worker cannot load a file the config imports. development-pepper.test.ts holds the two together.
export const developmentPepper = "ZGF5Ym9vay1kZXZlbG9wbWVudC1wZXBwZXItbm90LWE";

// The same for the push keys; vapid-keys.test.ts holds them together
export const developmentVapidKeys = {
  publicKey:
    "BBfpfm6Q_MlmP3iZV9GcX9Np8giJ1NPwNflJ__LCUQIpgd0TXaatflD3BTL0qlJbNwu8nsidSpHXMPsEzwCdm_w",
  privateKey: "2T5flB504mroN0xVqiLi725B_dULBJnD6sxFG0BEzb4",
} as const;

// Every quarter hour: the scheduler for notifications, whose times are in 15-minute steps (time-of-day.ts)
export const notificationSchedule = "*/15 * * * *";

export default defineConfig({
  worker: defineWorker(({ mode }) => ({
    name: "daybook",
    entrypoint: "./src/worker.ts",
    triggers: [
      triggers.scheduled({ schedule: notificationSchedule }),
      // One message at a time, in order; a message that keeps failing waits in jobs-dead
      triggers.queue({
        name: "jobs",
        deadLetterQueue: "jobs-dead",
        maxBatchSize: 1,
        maxConcurrency: 1,
        maxRetries: 3,
      }),
    ],
    compatibilityDate,
    compatibilityFlags,
    assets: { notFoundHandling: "none", runWorkerFirst: ["/_vinext/static-cache/*"] },
    // Workers Logs (free: 3 days, 200,000 lines a day): src/instrumentation.ts's faults, and each request's URL
    // without its query, where search words travel (ASVS 14.2.1, 16.2.3)
    observability: { enabled: true, redactQueryString: true },
    // Served at daybook.<subdomain>.workers.dev, the passkeys' RP ID. No preview URL per version: each would be one
    // more host on the same database (ASVS 3.5.4).
    workersDev: true,
    previewUrls: false,
    // Beside the D1 primary in Osaka; from the edge each query was ~100 ms (docs/guides/configuration.md)
    placement: { region: "aws:ap-northeast-3" },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "daybook", id: databaseId }),
      JOBS: bindings.queue({ name: "jobs" }),
      // The address the app is served from. A secret outside development, so the real one is not in the repository.
      APP_ORIGIN: mode === "development" ? bindings.text(developmentOrigin) : bindings.secret(),
      // Mixed into every password verifier. Development has a pepper of its own; it guards nothing real.
      PASSWORD_PEPPER:
        mode === "development" ? bindings.text(developmentPepper) : bindings.secret(),
      // Web Push's key pair. The public half is not secret, but it is set with the private one so the two never drift.
      VAPID_PUBLIC_KEY:
        mode === "development" ? bindings.text(developmentVapidKeys.publicKey) : bindings.secret(),
      VAPID_PRIVATE_KEY:
        mode === "development" ? bindings.text(developmentVapidKeys.privateKey) : bindings.secret(),
      // Workers AI reads notes. It has no local stand-in, so development calls the account's real one; the
      // end-to-end build has a table of answers instead (ADR 0012), given as a secret by e2e/serve.ts.
      ...(mode === endToEndMode
        ? { REPLAY_READINGS: bindings.secret() }
        : { AI: bindings.ai({ dev: { remote: true } }) }),
    },
  })),
});
