import { bindings, defineConfig, defineWorker } from "cf/config";

// The newest date the local workerd supports; raise it when the Cloudflare packages update.
// Shared with vitest.config.ts so tests run on the same runtime behaviour.
export const compatibilityDate = "2026-09-28";
export const compatibilityFlags = ["nodejs_compat"];

// Not a secret. `cf d1 migrations apply` needs it even for the local database.
export const databaseId = "f116c00d-1ef3-4841-831b-e821c5f8a29b";

export default defineConfig({
  worker: defineWorker({
    name: "daybook",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate,
    compatibilityFlags,
    assets: { notFoundHandling: "none", runWorkerFirst: ["/_vinext/static-cache/*"] },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "daybook", id: databaseId }),
    },
  }),
});
