# Architecture overview

How the pieces fit. The rules for writing code against them are in [AGENTS.md](../../AGENTS.md); the data model is in
[domain.md](domain.md).

## One Worker, two doors

```
Telegram (later) --webhook--+                             +-- D1 (SQLite)
                            +--> Cloudflare Worker -------+-- Workers AI (reading notes)
Browser / installed PWA ----+    (vinext + the core)      +-- cron: digests (later)
```

Everything runs in one Worker on Cloudflare's free plan. The web app is vinext - the Next.js App Router API on Vite -
rendered on the Worker, and it does everything on its own. The Telegram bot, an optional second door, and the cron
jobs come later and will share the same core.

## Feature slices

`src/features/` holds one folder per thing the product does - `access` (who is signing in), `capture` (words coming
in), `notes` (the notes kept), `customers`, `products`, `orders`, `reminders`, `reading` (a message read into an
order or a reminder), `reports` (a period's figures, reads only), and `merging` (two customers or two products that
are one) - each in four layers:

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

## Reading a note

Saving a note never waits for a model. Once the note is saved, the page asks for it to be read, in a request of its
own: the model on Workers AI returns the words of the message sorted into fields, checked by a Zod schema; the code
matches the customer and products, and places the order or adds the reminder through the same use cases as the forms,
in one batch with a record of the reading. The rules are in [domain.md](domain.md#reading), the reasons in ADR 0012.

## Merging two that are one

A merge moves every order and reminder of the customer (or every line of the product) merged away to the one kept,
through the order's own domain functions, with a log entry per order; it hides the merged one, naming the kept one,
turns its names into the kept one's other names, and records what moved - all in one D1 batch, whose first statements
check both records' versions, so a change made elsewhere meanwhile aborts the lot. There is no Undo; the screen says
what will move before it does. The rules are in [domain.md](domain.md#merging).

## Sign-in

Passkeys are the way in; a password, hashed with Argon2id in the browser, is the fallback. Sessions live 30 days in
D1; security settings ask to confirm again after five minutes. The reasons are in
[design.md](../product/design.md#sign-in), the rules in [domain.md](domain.md#access).
