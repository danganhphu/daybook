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

- **`APP_ORIGIN`** decides who passkeys belong to (the WebAuthn relying party: origin and RP ID) and which origin a
  write may come from. It is never taken from the request. It is a secret only so the real address stays out of a
  public repository.
- **`PASSWORD_PEPPER`** is mixed into every fallback-password verifier (HMAC-SHA256), so a copy of the database alone
  cannot be used to test guesses. Make one with
  `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`. Never commit it, never reuse the development
  one.
- Changing the pepper invalidates every fallback password (passkeys keep working). Rotation, keeping the old pepper
  for existing verifiers, is designed but not built.

## Runtime

| Setting | Where | Value |
| --- | --- | --- |
| Compatibility date | `cloudflare.config.ts` | the newest date the local workerd supports; raise it when the Cloudflare packages update |
| Compatibility flags | `cloudflare.config.ts` | `nodejs_compat` |
| Dev server port | `vite.config.ts` | 5173, from `developmentOrigin`; strict |

`vitest.config.ts` imports the compatibility date and flags, so tests run on the same runtime behaviour as the app.

## Environment variables for local runs

| Variable | Read by | Effect |
| --- | --- | --- |
| `APP_ORIGIN`, `PASSWORD_PEPPER` | `pnpm start` | the two secrets, for serving the production build locally |
| `DAYBOOK_PERSIST_TO` | `vite.config.ts` | a different folder for the local D1; the end-to-end tests use `.cloudflare/e2e-state` |
| `DAYBOOK_HTTPS=1` | `vite.config.ts` | serve over HTTPS with a certificate made on the spot |
