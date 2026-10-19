import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";
import vinext from "vinext";
import { defineConfig } from "vite";
import { patchCssModules } from "vite-css-modules";

export default defineConfig({
  css: {
    // Kebab-case in SCSS, camelCase keys in TypeScript
    modules: { localsConvention: "camelCaseOnly" },
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
    }),
  ],
});
