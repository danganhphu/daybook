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
- `e2e/serve.ts` empties `.cloudflare/e2e-state`, migrates it, seeds it and serves the build over HTTPS on port
  4173; the dev database is never touched. Nothing else may hold that port while it runs.
- One worker: scenarios share a database and empty the day through the screen. About three minutes.
- Tags: `@desktop-only`, `@phone-only`, `@chromium-only` (for steps that ask Chrome itself over CDP: install checks,
  and passkeys through `e2e/face-id.ts`, since Playwright's WebKit has none), `@iphone-later` (should pass on WebKit,
  does not yet; Android first, the owner's call). Never use `@chromium-only` to hide a WebKit failure.

## The seed

`e2e/seed.ts` makes random rows per run with the app's own code: Lan signed in (one fresh session, several old enough
to need step-up, each with its `session_opened` event), Lan's password, and setup links for Minh. Seeded things a
scenario spends - setup links, stale sessions - are counted in a file, so a retry never gets a used one. A value one
step finds for a later one (a link shown once) goes in the `remembered` fixture. The pepper is random per run and
passed to the preview as `PASSWORD_PEPPER`.

## Outside services

The breach check calls Have I Been Pwned from the browser; a scenario that sets a password answers it with
`page.route` ("mật khẩu nào cũng chưa từng bị lộ"). Never depend on the real service.

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
