/// <reference types="vite/client" />
// import.meta.glob is Vite's; vitest runs this file through Vite

import { describe, expect, it } from "vitest";

import { webManifest } from "./web-manifest";

const [written] = Object.values(
  import.meta.glob<string>("/public/manifest.webmanifest", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("the web manifest", () => {
  it("given the file pnpm icons wrote, when read, then it says what web-manifest.ts says", () => {
    expect(JSON.parse(written ?? "{}")).toEqual(webManifest);
  });
});
