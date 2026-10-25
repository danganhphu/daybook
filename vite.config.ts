import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";
import basicSsl from "@vitejs/plugin-basic-ssl";
import vinext from "vinext";
import { defineConfig } from "vite";
import { patchCssModules } from "vite-css-modules";

import { developmentOrigin } from "./cloudflare.config.ts";

// End-to-end tests point the local bindings at a state folder of their own, so they never touch the dev database
const persistTo = process.env["DAYBOOK_PERSIST_TO"];
// and serve HTTPS with a certificate made on the spot: WebKit keeps no Secure cookie over http://localhost
const https = process.env["DAYBOOK_HTTPS"] === "1";

const root = fileURLToPath(new URL(".", import.meta.url));

// A class's scoped name from its module's path alone. vite-css-modules hashes the id with its query, and a dev
// stylesheet <link> is served as "?direct", so a server component's classes missed its own stylesheet.
function scopedName(local: string, file: string): string {
  const relative = path.relative(root, file.split("?")[0] ?? file).replaceAll("\\", "/");
  const hash = createHash("sha256").update(`${relative}\0${local}`).digest("hex").slice(0, 7);

  return `_${local}_${hash}`;
}

export default defineConfig({
  // Passkeys are bound to the origin: a busy port is an error, not a quiet move to the next one
  server: { port: Number(new URL(developmentOrigin).port), strictPort: true },
  css: {
    // Kebab-case in SCSS, camelCase keys in TypeScript
    modules: { localsConvention: "camelCaseOnly", generateScopedName: scopedName },
    preprocessorOptions: {
      // Lets every module write `@use "abstracts" as *;`
      scss: { loadPaths: [fileURLToPath(new URL("./src/shared/ui/styles", import.meta.url))] },
    },
  },
  plugins: [
    // Writes a typed `.module.scss.d.ts` beside each module during dev and build; those are committed
    patchCssModules({ exportMode: "default", generateSourceTypes: true, declarationMap: true }),
    vinext({
      // @ts-expect-error vinext 1.2 types `options` as `T | undefined`, which exactOptionalPropertyTypes rejects
      cache: { cdn: staticAssetsAdapter() },
      prerender: { routes: "*" },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
      ...(persistTo === undefined ? {} : { persistState: { path: persistTo } }),
    }),
    ...(https ? [basicSsl({ certDir: ".cloudflare/e2e-certificate" })] : []),
  ],
});
