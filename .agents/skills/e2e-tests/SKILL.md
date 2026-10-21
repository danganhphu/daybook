---
name: e2e-tests
description: Writing and running the end-to-end suite - Gherkin scenarios in Vietnamese through playwright-bdd, three devices, the production build on its own D1, axe checks, and the browser traps already hit. Use this when adding a scenario or when an end-to-end run fails.
---

# End-to-end tests

Scenarios are `e2e/*.feature`, English keywords and Vietnamese steps. Steps are in `e2e/*.steps.ts`; the screen is
described once, in `e2e/today-page.ts`. `pnpm test:e2e` runs `bddgen`, then Playwright on an iPhone (WebKit), an
Android phone and a desktop - the last two as real Chrome (`channel: "chromium"`).

## Running

- It tests the last `pnpm build`. Build first.
- `e2e/serve.ts` empties `.cloudflare/e2e-state`, migrates it and serves the build; the dev database is never touched.
- One worker: scenarios share a database and empty the day through the screen. About a minute.
- Tags: `@desktop-only`, `@phone-only`, `@chromium-only` (for steps that ask Chrome itself over CDP).

## What an assertion must wait for

- **A write is saved only when the row says so.** The screen is optimistic: a note is visible before the server has
  answered. Wait for `aria-busy="false"` (`expectSaved`), or for the toast that only follows a server success.
- **Axe judges the screen at rest.** The axe step waits for running animations first; a toast still fading in reads as
  low contrast.

## Browser traps

- Playwright's default headless shell reports no install errors even for a page with no manifest. The Chromium
  projects use real Chrome for that reason.
- WebKit does not keep a `Secure` cookie over `http://localhost`. Anything that signs in needs the e2e server on HTTPS.
- Playwright counts `opacity: 0` as visible.

## A test needs teeth

Break the code a scenario guards - make the server action throw, lower a contrast - and watch the scenario fail
before trusting it. `pnpm test:e2e --repeat-each=3` before calling a new scenario stable.
