import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

import { databaseId } from "./cloudflare.config.ts";

const port = 4173;

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
    baseURL: `http://localhost:${port}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  // She may carry an iPhone or an Android phone; both are covered, and a desktop for the web app at a desk.
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
    command: "node e2e/serve.ts",
    url: `http://localhost:${port}`,
    env: {
      DAYBOOK_DATABASE_ID: databaseId,
      DAYBOOK_PERSIST_TO: ".cloudflare/e2e-state",
      DAYBOOK_E2E_PORT: String(port),
    },
    // Always a fresh, empty database
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
