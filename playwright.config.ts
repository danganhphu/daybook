import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

import { databaseId } from "./cloudflare.config.ts";

const port = 4173;
// HTTPS with a certificate made at start, which the browsers are told to accept: WebKit keeps no Secure cookie over
// plain http, and the session cookie is __Host-, so Secure
const origin = `https://localhost:${port}`;

const testDir = defineBddConfig({
  features: "e2e/*.feature",
  steps: ["e2e/fixtures.ts", "e2e/*.steps.ts"],
});

// End-to-end tests run the production build on a database of their own. One database for the whole run, so tests
// take turns, and each scenario starts by emptying the day. Kept apart from vitest.config.ts.
export default defineConfig({
  testDir,
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] === undefined ? 0 : 1,
  reporter: process.env["CI"] === undefined ? "list" : [["github"], ["html", { open: "never" }]],
  use: {
    baseURL: origin,
    ignoreHTTPSErrors: true,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  // The user may carry an iPhone or an Android phone; both are covered, and a desktop for the web app at a desk.
  // Chromium is real Chrome (new headless): the default headless shell passes an install check with no manifest.
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] },
      grepInvert: /@desktop-only|@chromium-only/,
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"], channel: "chromium" },
      grepInvert: /@desktop-only/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
      grepInvert: /@phone-only/,
    },
  ],
  webServer: {
    // The seed makes secrets with the app's own code, so Node resolves `@/` as Vite does
    command: "node --import ./scripts/register-source-paths.ts e2e/serve.ts",
    url: origin,
    ignoreHTTPSErrors: true,
    env: {
      DAYBOOK_DATABASE_ID: databaseId,
      DAYBOOK_E2E_PORT: String(port),
      // The production build reads its origin from the APP_ORIGIN secret; here it comes from the environment
      APP_ORIGIN: origin,
    },
    // Always a fresh, empty database
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
