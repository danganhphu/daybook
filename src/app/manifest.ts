import type { MetadataRoute } from "next";

import { appDescription, appName, canvasColor } from "./identity";

// Served as /manifest.webmanifest. The icons come from `pnpm icons`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appName,
    short_name: appName,
    description: appDescription,
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: canvasColor,
    theme_color: canvasColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
