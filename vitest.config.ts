import { readFile } from "node:fs/promises";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { configDefaults, defineConfig } from "vitest/config";

import {
  compatibilityDate,
  compatibilityFlags,
  developmentPepper,
  developmentVapidKeys,
} from "./cloudflare.config.ts";

// Kept apart from vite.config.ts so vinext's plugins stay out of tests. Bindings are declared inline:
// the plugin's reader for cloudflare.config.ts is still experimental.
export default defineConfig({
  // The `@/` imports the app uses; vinext resolves them for the app, Vite's own option does it here
  resolve: {
    tsconfigPaths: true,
    // vinext's own module for it, as its plugin maps it for the app
    alias: { "next/navigation": "vinext/shims/navigation" },
  },
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        compatibilityDate,
        compatibilityFlags,
        d1Databases: ["DB"],
        bindings: {
          // Read in Node and handed to tests/setup/d1.ts, which applies them before every test
          TEST_MIGRATIONS: await readD1Migrations({
            migrationsDir: "migrations",
            migrationsPattern: "migrations/*/migration.sql",
          }),
          // The headers static files are served with, for the test that holds them to the proxy's
          STATIC_HEADERS: await readFile("public/_headers", "utf8"),
          // The pepper dev runs with, for the test that holds it to the one the Worker refuses
          CONFIG_DEVELOPMENT_PEPPER: developmentPepper,
          // The same for the push keys
          CONFIG_DEVELOPMENT_VAPID_PUBLIC_KEY: developmentVapidKeys.publicKey,
          CONFIG_DEVELOPMENT_VAPID_PRIVATE_KEY: developmentVapidKeys.privateKey,
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./src/testing/setup/d1.ts"],
    // The end-to-end tests are Playwright's; bddgen writes them as *.spec.js, which Vitest would otherwise collect.
    // vendor/ holds other projects' tests (*.test.cjs), which are not ours to run.
    exclude: [...configDefaults.exclude, ".features-gen/**", "e2e/**", "vendor/**"],
  },
});
