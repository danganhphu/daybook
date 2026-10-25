# Architecture overview

How the pieces fit. The rules for writing code against them are in [AGENTS.md](../../AGENTS.md); the data model is in
[domain.md](domain.md).

## One Worker, two doors

```
Telegram (later) --webhook--+                             +-- D1 (SQLite)
                            +--> Cloudflare Worker -------+-- Workers AI (parsing, later)
Browser / installed PWA ----+    (vinext + the core)      +-- cron: digests (later)
```

Everything runs in one Worker on Cloudflare's free plan. The web app is vinext - the Next.js App Router API on Vite -
rendered on the Worker. The Telegram bot and the cron jobs come later and will share the same core.

## Feature slices

`src/features/` holds one folder per thing the product does - `access` (who is signing in), `capture` (words coming
in), `notes` (the notes kept), `customers`, `products`, `orders`, `reminders`, and `reports` (a period's figures,
reads only) - each in four layers:

| Layer | Holds | Depends on |
| --- | --- | --- |
| `domain/` | Types, state transitions as pure functions, branded Zod schemas, repository interfaces | nothing but other domains |
| `application/` | One use case per file, its dependencies as the first argument, the writes it needs | domains |
| `infrastructure/` | Drizzle tables, row mapping, repositories and writes over D1 | domain, application |
| `web/` | What server actions call, view models, the feature's React components | the feature, `shared/ui` |

Oxlint enforces the direction: domain or application code that imports Drizzle, Cloudflare APIs, infrastructure or
UI fails lint.

`src/composition/create-app.ts` is the one place that knows which implementation stands behind each port; it builds
the `App` that adapters receive. `src/app/` holds routes only - pages and server actions stay thin and call into a
feature's `web/`.

## A request

1. `src/proxy.ts` runs first: it refuses a write from another site (Fetch Metadata, then `Origin`), sends a browser
   with no session cookie to `/sign-in`, and sets the security headers and a per-request CSP nonce.
2. The page or server action calls `requireSession`, which proves the session cookie against D1. The proxy's
   redirect is only a shortcut; this is the check.
3. It calls a use case on the `App`. Expected failures come back as a `Result` with a code from the feature's closed
   set, each with the Vietnamese sentence the person sees; faults throw.
4. Writes are queued on a unit of work and committed as one D1 batch, atomically.

## Sign-in

Passkeys are the way in; a password, hashed with Argon2id in the browser, is the fallback. Sessions live 30 days in
D1; security settings ask to confirm again after five minutes. The reasons are in
[design.md](../product/design.md#sign-in), the rules in [domain.md](domain.md#access).
