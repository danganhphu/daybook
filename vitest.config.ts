import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { compatibilityDate, compatibilityFlags } from "./cloudflare.config.ts";

// Kept apart from vite.config.ts so vinext's plugins stay out of tests. Bindings are declared inline:
// the plugin's reader for cloudflare.config.ts is still experimental.
export default defineConfig({
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
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./tests/setup/d1.ts"],
  },
});
