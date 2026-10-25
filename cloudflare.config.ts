import { bindings, defineConfig, defineWorker } from "cf/config";

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

const developmentPepper = "ZGF5Ym9vay1kZXZlbG9wbWVudC1wZXBwZXItbm90LWE";

export default defineConfig({
  worker: defineWorker(({ mode }) => ({
    name: "daybook",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate,
    compatibilityFlags,
    assets: { notFoundHandling: "none", runWorkerFirst: ["/_vinext/static-cache/*"] },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "daybook", id: databaseId }),
      // The address the app is served from. A secret outside development, so the real one is not in the repository.
      APP_ORIGIN: mode === "development" ? bindings.text(developmentOrigin) : bindings.secret(),
      // Mixed into every password verifier. Development has a pepper of its own; it guards nothing real.
      PASSWORD_PEPPER:
        mode === "development" ? bindings.text(developmentPepper) : bindings.secret(),
      // Workers AI reads notes. It has no local stand-in, so development calls the account's real one; the
      // end-to-end build has a table of answers instead (ADR 0012), given as a secret by e2e/serve.ts.
      ...(mode === endToEndMode
        ? { REPLAY_READINGS: bindings.secret() }
        : { AI: bindings.ai({ dev: { remote: true } }) }),
    },
  })),
});
