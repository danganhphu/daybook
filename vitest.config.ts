import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { compatibilityDate, compatibilityFlags } from "./cloudflare.config.ts";

// Kept apart from vite.config.ts so vinext's plugins stay out of tests. Bindings are declared inline:
// the plugin's reader for cloudflare.config.ts is still experimental.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate,
        compatibilityFlags,
        d1Databases: ["DB"],
      },
    }),
  ],
});
