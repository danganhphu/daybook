# Testing

Two layers: Vitest for everything that can be checked without a browser, Playwright for the flows a person would
notice breaking.

## Unit and use-case tests

```sh
pnpm test           # once
pnpm test:watch     # while working
```

- They run **inside workerd**, the Workers runtime, through `@cloudflare/vitest-plugin`, against a real local D1.
  Every test starts on an empty, fully migrated database (`src/testing/setup/d1.ts`).
- **Use cases run for real:** `testApp` in `src/testing/support/app.ts` is the actual app over the test's database,
  with a clock moved by hand. Our own code is not mocked.
- Passkeys come from a software authenticator (`src/testing/support/authenticator.ts`) with real keys, so each
  tampering case still carries a valid signature and fails for its own reason.
- Names read as a sentence: `given <state>, when <action>, then <outcome>`.
- An architecture test (`src/testing/access-boundary.test.ts`) reads the source and fails when a page or server action
  does not check the session.

## End-to-end tests

```sh
pnpm build
pnpm test:e2e
```

- Scenarios are Gherkin in `e2e/*.feature`, English keywords and Vietnamese steps, turned into Playwright specs by
  playwright-bdd. Steps live in `e2e/*.steps.ts`.
- Three devices: an iPhone 15 (WebKit), a Pixel 7 and a desktop, the last two in real Chrome
  (`channel: "chromium"`).
- They test **the production build** over HTTPS on port 4173, on a database of their own in `.cloudflare/e2e-state`,
  made fresh by `e2e/serve.ts` for every run. Nothing else may hold the port.
- **The seed** (`e2e/seed.ts`) makes random rows with the app's own code: Lan signed in, sessions old enough to need
  step-up, Lan's fallback password, and setup links for Minh. The pepper is random per run.
- Passkeys come from Chrome's virtual authenticator (`e2e/face-id.ts`), so passkey scenarios are tagged
  `@chromium-only`; Playwright's WebKit has none. The breach check is answered by the run, never by the real service.
- Every page fails its scenario on a Content Security Policy violation or an uncaught error.
- The step `trang không có lỗi trợ năng` runs axe against WCAG 2.2 A and AA, after animations finish.
- Tags: `@desktop-only`, `@phone-only`, `@chromium-only`.

A failed test keeps its trace in `test-results/` (open it with `pnpm exec playwright show-trace <file>`). In CI the
HTML report, traces included, is kept as an artifact for 14 days.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on `main`:

- `check`: `pnpm audit`, format, lint, typecheck, unit tests, build, and a check that the committed
  `*.module.scss.d.ts` files match what the build wrote.
- `e2e`: installs Chromium and WebKit, builds, runs the end-to-end suite.

Pull requests also check their title against Conventional Commits and refuse a new dependency with a known
vulnerability.
