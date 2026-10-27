# Configuration

Everything the Worker is given is declared once, in `cloudflare.config.ts`, and read through one schema at the first
request (`src/composition/daybook.ts`): a missing or malformed value fails loudly instead of half-working.

## Bindings

| Name | Kind | In development | Everywhere else |
| --- | --- | --- | --- |
| `DB` | D1 database | the local SQLite file in `.cloudflare/state` | the `daybook` database on Cloudflare |
| `ASSETS` | static assets | the build's assets | the same |
| `APP_ORIGIN` | URL | `http://localhost:5173` | a Worker secret: the URL the app is served from |
| `PASSWORD_PEPPER` | 32 random bytes, base64url | a fixed value that guards nothing real | a Worker secret |
| `AI` | Workers AI | the account's real one, remotely | the same; not in the end-to-end build |
| `REPLAY_READINGS` | JSON | - | only in the end-to-end build: a secret `e2e/serve.ts` sets |

- **`APP_ORIGIN`** decides who passkeys belong to (the WebAuthn relying party: origin and RP ID) and which origin a
  write may come from. It is never taken from the request. It is a secret only so the real address stays out of a
  public repository.
- **`PASSWORD_PEPPER`** is mixed into every fallback-password verifier (HMAC-SHA256), so a copy of the database alone
  cannot be used to test guesses. Make one with
  `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`. Never commit it, never reuse the development
  one: the Worker refuses the development pepper unless `APP_ORIGIN` is localhost
  (`src/features/access/infrastructure/development-pepper.ts`).
- Changing the pepper invalidates every fallback password (passkeys keep working). Rotation, keeping the old pepper
  for existing verifiers, is designed but not built.
- **`AI`** reads notes (ADR 0012). Workers AI has no local stand-in, so `pnpm dev` calls the real one, and each note
  read there spends the account's free Neurons: 10,000 a day, about 8 a message, a hard stop with no bill, back at
  00:00 UTC (07:00 in Vietnam). Cloudflare does not keep or train on what is sent. The Vite plugin keeps a login of its
  own, apart from `cf auth login`: the first `pnpm dev` in a terminal opens the browser to sign in, and where nothing
  can be typed (an agent's shell, CI) it needs `CLOUDFLARE_API_TOKEN` instead. Without the binding the app still
  records notes; they are simply not read.
- **`REPLAY_READINGS`** stands in for `AI` in the build `pnpm build:e2e` makes (`--mode e2e`): messages and what
  each says, as JSON (`e2e/readings.ts`). The production build has no such binding.

## Runtime

| Setting | Where | Value |
| --- | --- | --- |
| Compatibility date | `cloudflare.config.ts` | the newest date the local workerd supports; raise it when the Cloudflare packages update |
| Compatibility flags | `cloudflare.config.ts` | `nodejs_compat` |
| Workers Logs | `cloudflare.config.ts`, `observability` | on, query strings redacted (search words travel there); free plan keeps 3 days, 200,000 lines a day |
| Where it is served | `cloudflare.config.ts`, `workersDev`, `previewUrls` | `daybook.<subdomain>.workers.dev` only, the passkeys' RP ID; no preview URL per version, which would be another host on the same database |
| Where it runs | `cloudflare.config.ts`, `placement` | beside the D1 primary (Osaka, `aws:ap-northeast-3`), not at the edge that took the request; see below |
| Dev server port | `vite.config.ts` | 5173, from `developmentOrigin`; strict |

What reaches Workers Logs: each request's method, URL without its query, and status; one JSON line per fault from
`src/instrumentation.ts`; and vinext's own line for a failed server action, which can carry a failed query's
parameters (see [security](../architecture/security.md#logs)).

**Why the placement.** A D1 database has one primary, and without read replication every query goes to it. Ours was
created in the Asia-Pacific region and landed in Osaka. A request from Vietnam reaches Cloudflare in Singapore; run
there, the Worker paid about 100 ms per query for a statement that takes 0.14 ms, and a screen makes two to four of
them in a row. Placed beside the database, the request crosses to Osaka once and each query is a few milliseconds.
D1 takes only a region as a hint, not a city, so the database cannot simply be put in Singapore. Check where the
primary is with `pnpm exec cf d1 query <database-id> --sql "select 1"` (`served_by_colo` in the answer), and move the
placement if it ever changes.

**CPU per request.** Workers Free allows 10 ms of CPU per request, with some slack for the odd request over; a
Worker over it consistently is cut off (error 1102). Waiting on D1 does not count. Measured on 2026-10-27, a first
open on a cold Worker took 62 ms and a screen change 10-25 ms, mostly vinext and React rendering, and no request was
cut. What the app keeps off that path: no Intl on the server (the day is a fixed `+07:00`), the WebAuthn library
loaded only when a passkey is used, the icons and manifest as static files, and one read per kind of record rather
than one per person. To look again, profile locally through workerd's inspector under `vite preview` (port 9229;
send `Origin: http://localhost`), or in production with `cf workers versions profile` while the app is in use. Workers
Paid ($5 a month) lifts the limit to 30 s by default.

Static files are served before the Worker runs, so they carry `public/_headers` instead of the proxy's headers. Keep
the two in step; `src/features/access/web/static-headers.test.ts` fails when they drift.

`vitest.config.ts` imports the compatibility date and flags, so tests run on the same runtime behaviour as the app.

## Environment variables for local runs

| Variable | Read by | Effect |
| --- | --- | --- |
| `APP_ORIGIN`, `PASSWORD_PEPPER` | `pnpm start` | the two secrets, for serving the production build locally |
| `DAYBOOK_PERSIST_TO` | `vite.config.ts` | a different folder for the local D1; the end-to-end tests use `.cloudflare/e2e-state` |
| `DAYBOOK_HTTPS=1` | `vite.config.ts` | serve over HTTPS with a certificate made on the spot |
