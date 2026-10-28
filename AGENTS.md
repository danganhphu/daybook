# AGENTS.md

## What this is

A notebook for a salesperson on the move: orders, customers and follow-ups, typed the way you would text a friend.
The usual alternative is the phone's notes app, where things get scattered and half of them forgotten.

Two equal doors, each usable alone: the web app (a PWA) does everything, and a Telegram bot is an optional way in for
whoever lives in Telegram. Anything the bot does, the web does too. Both are thin adapters over one core.

The design is in [docs/product/design.md](docs/product/design.md). Read it before proposing changes to the
interaction model; the decisions in it have reasons attached, and several of them are deliberate reversals of the
obvious choice. [docs/README.md](docs/README.md) lists every document.

## Status

The web app works locally, whole: today's notes as a chat, read into orders and reminders by Workers AI; days and a
search; customers, products (with the other names each is known by, and merging two that are one), orders with
delivery, payments and history; reminders, open and finished; reports; what was deleted lately, to restore; and
sign-in with passkeys, a password as the fallback, and Settings for the account, its devices and the people. It
installs to a phone's home screen, and speaks first: a morning list and a Friday summary at each person's times, and
notices about their sign-in, by Web Push (its service worker shows notifications and caches nothing). The Telegram bot
comes next.

## Hard constraint: $0, no card

Everything runs on Cloudflare's free plan, with no payment method on the account. Over a limit, Cloudflare refuses
requests instead of billing, which is the point. Do not add anything that needs a card or can bill.

That constraint picked the platform. AWS, Azure and Google Cloud all want a card, and none of them will stop at $0;
Cloudflare does, but Workers cannot run .NET, which is why this is TypeScript and not the .NET stack first planned.

The free-plan limits that shape the code:

| Limit | Consequence |
|---|---|
| 10 ms CPU per request or cron run | Waiting on I/O does not count, so an LLM call is fine. Server rendering on every request is the risk - measure CPU time from the first deploy |
| 100,000 Worker requests a day | Static asset requests are free and do not count |
| D1: 5M rows read, 100k rows written a day | Index every lookup. An unindexed scan counts every row it touches as read |
| Workers AI: 10,000 Neurons a day | It errors once used up. Local dev calls the real service, so dev runs spend the same budget |
| 5 Cron Triggers per account, UTC only | 07:30 in Vietnam is `30 0 * * *`. Write day names (`FRI`): in Cloudflare's numbering 1 is Sunday. One is used: the notifications' scheduler, every 15 minutes |
| Queues: 10,000 operations a day, 24 hours' retention | A message is three operations. Jobs carry ids, never words |

## Stack

| Concern | Choice |
|---|---|
| Platform | One Cloudflare Worker serving the PWA, the Telegram webhook and the cron jobs |
| Web | [vinext](https://github.com/cloudflare/vinext): the Next.js 16 API on Vite, built for Workers. Next.js App Router conventions apply, but parity is not complete - check vinext's compatibility notes before using an uncommon Next feature |
| Components | Base UI for behavior and accessibility; our own design system on top, in SCSS. See [docs/ui/design-system.md](docs/ui/design-system.md) |
| Styling | Sass (`sass-embedded`) as CSS Modules beside each component, tokens in `src/shared/ui/styles/`. Not Tailwind: Tailwind 4 is not built to sit beside a preprocessor |
| Icons | Material Symbols Rounded, generated as components by `pnpm symbols` from Iconify's data; no icon library at run time. Why not Lucide or Phosphor: [docs/ui/design-system.md](docs/ui/design-system.md#icons) |
| Font | Inter with the `vietnamese` subset. Geist has no Vietnamese glyphs |
| Browser-side server state | TanStack Query, once a screen needs client caching or optimistic updates. Not SWR: same job, less for mutations |
| Client state | None until something needs it, then Zustand. Not Redux Toolkit: far more machinery than one user needs |
| Tables | TanStack Table (headless), styled by us |
| Cloudflare CLI | `cf` with a typed `cloudflare.config.ts`. Not Wrangler |
| Database | D1, through Drizzle ORM (1.0 release candidate, pinned to an exact version) |
| Validation | Zod 4. One schema drives input validation, the LLM's `response_format` and the check on what it returns |
| LLM | Workers AI binding, with Groq as the fallback |
| Telegram | grammY in webhook mode, verified with `secret_token` |
| Tests | Vitest 4.1 with `@cloudflare/vitest-plugin`, running inside workerd against a real local D1; Playwright with axe for the few end-to-end flows that matter. Not Vitest 5: with plugin 1.4.2 every suite fails before running ("File path must be a file: URL") |
| Language | TypeScript 7 |
| Tooling runtime | Node 26 |
| Package manager | pnpm |
| Lint and format | Oxlint (type-aware), Stylelint, Oxfmt |

A library arrives with the feature that needs it, not ahead of it. One per concern - never two that do the same job.

vinext and `cf` are both pre-1.0-stable choices, taken on purpose: the product is not shipping soon, and they are
the direction Cloudflare recommends for new projects. If vinext's server rendering will not fit in 10 ms of CPU,
the fallback stays inside the same toolchain: `output: "export"`, served as static assets.

## Architecture

- **No logic in an adapter.** The Telegram adapter and the web pages call the core; the core never imports from
  them. A third entrance - Zalo, Messenger - has to be a thin layer, not a rewrite.
- **The Worker's entry is `src/worker.ts`**, with `fetch` (vinext's handler, imported statically: vinext 1.2's build
  cannot split it out), `scheduled` and `queue`. The scheduler and the consumer load their code with `import()` on
  first use, from `src/composition/jobs.ts`, never `createApp`. The bot's webhook will be routed there, before vinext.
- **Slow work goes through the `jobs` queue**, with an idempotent consumer: a job carries ids, the consumer claims a
  ledger row before it sends, and a failure is retried with backoff, then dead-lettered (ADR 0013, ADR 0015). Not
  `ctx.waitUntil`: a reply lost there is lost for good.
- **Web Push goes through the `PushSender` port**; only `web-push-sender.ts` imports `@block65/webcrypto-web-push`, and
  only the consumer loads it. A subscription's address is kept only on a known push service's domain, since the Worker
  posts to it, and never logged. `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are secrets outside development, set
  together; development has a pair of its own, refused anywhere but localhost. No test calls a push service.
- **Never lose the user's words.** Every message is stored verbatim in `capture` before anything else happens, including
  when parsing fails or the LLM quota has run out. Re-parsing later is what makes a free LLM tier safe to rely on.
- **Nothing polls.** Work happens on a request or on a cron trigger.

## Source layout

Everything is under `src/`, organised by what the product does, not by framework: a vertical slice per feature, and
Clean Architecture layers inside each slice, in TypeScript idiom - types and functions, not classes.

```
src/
  app/            routes only (Next.js App Router): layout, pages, server actions, the manifest and icons, /dev/ui
  features/
    access/       who is signing in: accounts, passkeys, sessions, setup links, the access events
    capture/      the user's words coming in: the Capture aggregate, recordCapture
    notes/        the notes kept: the Note aggregate, edit, delete, restore, the day's list, search
    customers/    customers, the other names they are known by, and the owner's kinds of customer
    products/     what is sold: made the first time an order names it, or added; its other names
    orders/       the Order aggregate with its lines and payments, its change log, the order lists' reads
    reminders/    what to do and when, for a customer or not
    reading/      a message read into an order or a reminder: the Interpretation, the Workers AI reader, the answers
    reports/      a period's figures: the period and its buckets, the aggregate reads (no writes)
    merging/      two customers or two products that are one: everything moved to one, in one batch, and recorded
    notifications/  the app speaking first: times, push subscriptions, the scheduler, the delivery ledger, Web Push
    book-settings/  what the book is set to, shared by both people: the days after which a customer has gone quiet
  jobs/           the scheduler's and the queue consumer's adapters: what `src/worker.ts` hands a cron run and a message
  shared/
    domain/       Result, Content, the Vietnamese day
    application/  Clock, the UnitOfWork type
    infrastructure/  the D1 client and batch, the system clock, the schema tests
    ui/           the design system: components and styles/
  composition/    createApp, the jobs' own root (jobs.ts) and the unit of work: where everything is wired together
  worker.ts       the Worker's entry: fetch, scheduled, queue
  testing/        test setup and helpers
```

Inside a slice:

| Layer | Folder | Holds | May import |
|---|---|---|---|
| Domain | `domain/` | Types, state transitions as pure functions, branded value schemas, repository interfaces | other domains and `shared/domain`, plus Zod, uuid, Temporal |
| Application | `application/` | One use case per file, dependencies as its first argument. The ports it owns: what it writes (`NoteWrites`), its error codes | domains and `shared/application` |
| Infrastructure | `infrastructure/` | Drizzle tables (`*.table.ts`), row mapping, the repository and writes over D1 | anything but `app`, `composition` |
| Web | `web/` | The feature's web adapter: the commands server actions call, its view model, its React components | the feature, the `App` type, `shared/ui` |

- **Oxlint enforces the first two rows** (`overrides` in `.oxlintrc.json`): domain or application code that imports
  Drizzle, `cloudflare:*`, infrastructure, `composition` or UI fails lint. Application tests are exempt; they run the
  real app.
- **A new feature is a new folder** in `src/features/`, with the same layers, wired up in `src/composition/`.
  Routes in `src/app/` stay thin: a page or a server action calls into the feature's `web/`.
- **Writes go through the unit of work.** Each feature declares what it writes (`CaptureWrites`, `NoteWrites`); a
  use case names the stores it needs (`UnitOfWork<{ notes: NoteWrites }>`); `src/composition/unit-of-work.ts` puts
  every store on one D1 batch. Shared code never knows a feature's tables.
- **Adapters receive an `App`** and call its use cases. They never import a repository, a table or Drizzle.
- **An aggregate is a module.** `import * as Notes from "@/features/notes/domain/note"`, then
  `Notes.edit(note, ...)`.
- **Domain values are immutable**; a transition returns a new value. States are discriminated unions
  (`LiveNote | DeletedNote`), so a function that needs a live note says so in its type.
- **Checked values are branded Zod types** (`Content`, `NoteId`): they can only be had by parsing, so nothing
  downstream receives unchecked input. Rows read back from D1 are parsed into them too.
- **The browser does not load Zod** outside the passkey screens. A value it checks as well (`Content`, `Money`) has
  its rule in plain code and its schema built from that rule (`checkedSchema`, `content-schema.ts`); a limit a form
  shows sits in a `*-limits.ts` beside the aggregate. `src/testing/browser-imports.test.ts` holds the line.
- The model, its vocabulary and its rules are in [docs/architecture/domain.md](docs/architecture/domain.md).
  Propose a change to the data model there before writing it.
- **A value used twice has one name.** Paths are `routes` (`src/shared/web/routes.ts`); words every screen shares
  are `actionLabels` (`src/shared/ui/action-labels.ts`); a feature's terms and copy sit with it (`access-terms.ts`,
  `access-copy.ts`); limits and lengths live in the domain (`access-policy.ts`, `usernameLength`) and the tables'
  `CHECK`s read them through `sqlNumber`/`sqlTextList`. Grep before typing a literal a second time.

## Errors

- **An outcome the user can cause is a `Result`** (`src/shared/domain/result.ts`): a note that is gone, editing a
  deleted note. The error is a code from the feature's closed set (`NoteError` in
  `src/features/notes/application/note-errors.ts`), and each use case narrows its return type to the codes it can
  produce, so a caller handles exactly those.
- **A fault throws**: D1 unreachable, a constraint the code should have prevented, a bug. Nothing below the adapter
  catches it.
- The reason is that a signature then says what can go wrong. Not speed: a throw costs microseconds next to a
  network round trip.
- **No Maybe type.** `T | undefined` under strict null checks is the Maybe, and the compiler checks it. No `null`
  in domain types; it stays in the row mapping.
- **Every code has the sentence the user sees** in the feature's messages (`noteErrorMessages`), and
  `satisfies Record<NoteError, string>` fails the build if one is missing. Adapters show these; they do not word
  their own.

## Access

Two people share one book and sign in with passkeys, a password being the fallback; `docs/product/design.md`
"Sign-in" says why, `docs/architecture/domain.md` "Access" has the rules in full. What code must never get wrong:

- **No secret is stored, logged or put in a query string as itself.** Session secrets, setup tokens and ceremony
  bindings are 256 random bits from `Secrets`; only their SHA-256 reaches D1, and presented secrets are checked with
  `secretTokenMatches` (constant time). A setup token travels in a URL fragment and reaches the server in a POST body.
- **Only a use case that has just authenticated someone opens a session**, through `enlistNewSession` on its own unit
  of work. No adapter calls it, and nothing exposes it on the `App`.
- **Security settings check step-up in the use case** (`isSteppedUp` in `step-up.ts`), not only in the screen. A
  step-up is a passkey sign-in for the same account, or a password sign-in for an account with no passkey: a fresh
  session replaces the old one. On an account with a passkey a password sign-in never counts, so a phished password
  cannot add a passkey. The page asks only when the server answers `step_up_required` (`useStepUp` in
  `src/app/settings/`), then runs the action once more.
- **The password never reaches the server.** The browser normalises it, checks its length and Pwned Passwords, and
  sends only an Argon2id key derived with a salt the server chose (`browser-password.ts`); the server keeps an HMAC
  of it under the versioned `PASSWORD_PEPPER`. Unknown usernames get a decoy salt; every answer reads the same.
- **The page never decides who someone is.** Every page and server action calls `requireSession` first, except the
  named public ones; `src/testing/access-boundary.test.ts` fails on one that does not. `src/proxy.ts` refuses
  cross-site writes (Fetch Metadata, then Origin against `APP_ORIGIN`) and sets the CSP with a per-request nonce.
- **A WebAuthn challenge is spent before its response is verified**, in one statement
  (`CeremonyRepository.spendChallenge`), so two answers to one prompt cannot both pass. Never verify first.
- **WebAuthn goes through the `PasskeyVerifier` port.** Only `simple-webauthn-verifier.ts` imports
  `@simplewebauthn/server`. It requires user verification, and passes the library a counter of 0: a counter that did
  not grow is a signal the domain records (`Passkeys.recordUse`), never a refusal. Its tests pin each refusal reason,
  so an upgrade that rewords the library's errors fails them.
- **The relying party comes from configuration, never from a request.** The RP ID is the full host.
- **Every access attempt is recorded** in `access_event`, successes and refusals alike. Never a token, secret,
  challenge, credential response or derived key in it; the session id is the public half of a cookie and may appear.
  A request with no ceremony of this browser behind it is refused without a log entry, so nobody can grow an
  append-only log by sending junk.
- **Rate limits count a client**, an IPv4 address or an IPv6 /64, in D1 (`createRateLimiter`), exact rather than the
  approximate per-location binding. A typed username is keyed with the pepper before it becomes a limit's key.
- **Static files carry `public/_headers`**, which the Worker never sees; `static-headers.test.ts` holds it to the
  proxy's headers. A fault leaves one line in Workers Logs through `src/instrumentation.ts`, never headers or a query.
- **The command line is for two moments only**: the first account, and break-glass (`pnpm access:*`, below). It runs
  the app's own use cases and writes against a batch that records SQL, then sends it through `cf d1 query` with
  `--remote`, or straight into the dev database's SQLite file with `--local` (cf has no local query), in one
  transaction; `--dry-run` prints it. Everything else - invites, recovery, passwords, usernames - is in Settings.
- **Configuration:** `APP_ORIGIN` (the relying party and the Origin check) and `PASSWORD_PEPPER` (32 random bytes,
  base64url) are text bindings in development and Worker secrets otherwise (`cloudflare.config.ts`). The real URL and
  pepper never enter the repository; the development pepper is refused anywhere but localhost.

## Database

- **D1, one database** (`daybook`, APAC), bound as `DB` in `cloudflare.config.ts` with its real id.
- **Writes go through a unit of work.** D1 has no interactive transactions, but a batch is atomic: a use case
  queues its changes and `commit()` sends them as one batch, all or none. Repositories only read.
- **Schema change:** edit the feature's `infrastructure/*.table.ts`, run `pnpm db:generate --name <what_it_does>`, read
  the generated `migrations/<timestamp>_<name>/migration.sql`, add what Drizzle cannot emit (below), then
  `pnpm db:migrate` to apply it to the local database the dev server uses. The drizzle-kit skills cover the commands.
- **Added by hand: `STRICT` on every table, and the triggers**: the logs and records that are append-only (`capture`,
  `access_event`, `order_change`, `interpretation`, the merge records), a `setup_link` redeemed once, the audit
  triggers, and a merged customer or product only while hidden. Drizzle cannot emit either and its snapshot does not
  know about them, so a migration that rebuilds a table drops them silently. `src/shared/infrastructure/d1/schema.test.ts` and
  `src/features/access/infrastructure/access-schema.test.ts` fail when that happens. Say what was hand-edited at the
  top of the file.
- **Rules that matter are kept by the database too**, not only by code: `CHECK` for known values and non-blank
  content, foreign keys, the triggers.
- **`capture` is never updated or deleted**, by code or by hand. Corrections go to the note.
- **Anything derived from a capture keeps its `capture_id`**, so every record traces back to what was typed.
- **Times are epoch-millisecond integers** in the database and `Temporal.Instant` in code, converted in the row
  mapping. Import Temporal from `temporal-polyfill/implementation`, never the bare package, so a broken native
  Temporal in the runtime is never picked up.
- **Ids are UUIDv7**, so they also sort by creation time.
- **Deletes are soft** (`deleted_at`); Undo is an update.
- Applying migrations to the remote database is a deploy-grade action: only when asked.

## Tests

- **Test first.** Write the test for a new behaviour, watch it fail, then make it pass.
- **Names read as a sentence**: `given <state>, when <action>, then <outcome>`, inside a `describe` named after the
  function or use case.
- **Use cases run for real**: `testApp` in `src/testing/support/app.ts` is the real app over the test's D1, and
  time is a `testClock` moved by hand. Do not mock our own code. Domain functions are tested directly, without a
  database.
- **Every test starts on an empty, fully migrated database** (`src/testing/setup/d1.ts`).
- **A test needs teeth.** Break the code it guards and see it fail before trusting it. Dropping `STRICT` fails
  exactly the STRICT tests; committing writes one at a time instead of as a batch fails the atomicity test.
- **Assert what matters, not someone else's wording**: that no row was stored, not the driver's error text.
- Tests sit next to the code as `*.test.ts`. `vitest.config.ts` declares bindings inline (the plugin's reader for
  `cloudflare.config.ts` is experimental) and imports the compatibility date and flags from `cloudflare.config.ts`,
  so tests and the app run on the same runtime behaviour.

End-to-end tests cover the flows a user would notice breaking; everything else is a Vitest test.

- **Scenarios are Gherkin** in `e2e/*.feature`, with English keywords and Vietnamese steps, run by Playwright
  through playwright-bdd on an iPhone (WebKit), an Android phone (Chromium) and desktop Chrome. Tag a scenario
  `@desktop-only` or `@phone-only` when the devices behave differently, like what Enter does, and `@chromium-only`
  when it asks Chrome itself over the DevTools protocol. `@iphone-later` marks a scenario that should pass on the
  iPhone but does not yet: Android comes first, and each one is in the project's known gaps.
- **Chromium is real Chrome** in its new headless mode (`channel: "chromium"`). Playwright's default headless shell
  is not full Chrome: asked whether a page installs, it reports no errors even for a page with no manifest.
- **They run the production build** over HTTPS on a D1 of their own in `.cloudflare/e2e-state`: `e2e/serve.ts`
  empties and migrates it, seeds it (`e2e/seed.ts`, with the app's own code for secrets and a random pepper per run),
  then serves `pnpm build`'s output, so the dev database is never touched. Each scenario starts by emptying the day
  through the screen, which is why they run one at a time.
- **The seed** signs Lan in (fresh, and several sessions old enough to need step-up), gives her a password, and gives
  Minh setup links. What can be spent - setup links, stale sessions - is counted in a file, so a retry never gets a
  used one. A step that finds something for a later step keeps it in the scenario's `remembered` fixture.
- **Every page fails its scenario** on a CSP violation or an uncaught error (the `page` fixture in `e2e/fixtures.ts`).
- **Find things the way a user does**: by role and by the words on screen, never by class name or test id. The today
  screen is described once, in `e2e/today-page.ts`. Passkeys come from Chrome's virtual authenticator
  (`e2e/face-id.ts`); the breach check is answered by the run, never by the real service.
- **A screen is checked with axe** against WCAG 2.2 A and AA, in the step `trang không có lỗi trợ năng`. It lets
  running animations finish first: axe measures colour as painted, so a toast still fading in fails contrast.
- `bddgen` writes the specs into `.features-gen/`, which is gitignored and skipped by Vitest.

## Setup

- Node 26 and pnpm. `.node-version` pins Node for version managers that read it; the pnpm version is pinned in
  `package.json`. Node no longer ships Corepack, so install pnpm itself once - see https://pnpm.io/installation.
- Clone with `--recurse-submodules`, or run `git submodule update --init` in an existing clone: `vendor/` holds the
  security reference the `security` skill reads.
- `pnpm install`. `pnpm-workspace.yaml` holds the supply-chain settings: new releases wait a day, a drop in publish
  trust fails the install, and dependency build scripts run only for packages listed under `allowBuilds`. Review a
  package before adding it there. Versions are pinned exactly.
- `pnpm exec cf auth login`. It opens a browser to approve access, so a person does it, not an agent.
- `pnpm exec playwright install chromium webkit` once, for the end-to-end tests. On Linux, add `--with-deps`.
- Claude Code: trust the folder when asked. `.claude/settings.json` declares the `cloudflare/skills` marketplace
  and enables its `cloudflare` plugin, which brings Cloudflare's skills and the Cloudflare MCP server. If Claude
  Code reports it as enabled but not installed, run `claude plugin install cloudflare@cloudflare --scope project`.
- VS Code: trust the folder, then install what `.vscode/extensions.json` recommends - TypeScript 7
  (`TypeScriptTeam.native-preview`), Oxc, Stylelint, EditorConfig. Prettier, ESLint and Tailwind IntelliSense are
  listed as unwanted here; disable them for this workspace.

## Cloudflare tooling

- Use `cf`. For the few things it cannot do yet, run Wrangler through `npx` without adding it to the project:
  `npx wrangler tail <worker>`, `npx wrangler secret put <name> --name <worker>`.
- Find commands with `cf cli search "<task>"` and check them with `--help` or `cf schema`. Do not translate
  Wrangler commands from memory.
- Preview with `--dry-run`. A destructive command that aborts for lack of `--force` still exits 0.
- Never deploy, delete a resource or change a secret unless asked. Those reach the live app.
- Generated binding types live in `.cloudflare/types`, which is gitignored and listed in `tsconfig.json`.
  `cf workers types` regenerates them outside the Vite workflow; `pnpm typecheck` runs it first.
- Keep `compatibilityDate` at the newest date the local `workerd` supports. Above it the dev server refuses to
  start, and `build` does not notice.

## TypeScript

- **TypeScript 7 only**, the native compiler, so `tsc` is TS 7. Nothing here needs the TS 6 JavaScript API - that
  is why linting is Oxlint rather than typescript-eslint - so there is no `@typescript/typescript6` alias. If a
  tool ever needs one, add the alias pair from the TS 7 release notes; do not downgrade.
- **tsconfig:** `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
  `noUnusedParameters`, `verbatimModuleSyntax` and `erasableSyntaxOnly`, with `moduleResolution: "bundler"`. List
  `types` explicitly, because TS 7 defaults it to `[]`. Never `baseUrl`; TS 7 rejects it.
- **Time:** the Workers runtime has no Temporal yet, so use `temporal-polyfill` until it does. Store instants in
  UTC and convert to `Asia/Ho_Chi_Minh` at the edges.
- **Ids** are UUIDv7, from the `uuid` package's `v7()`. `crypto.randomUUID()` is v4 only.

## Code style

The bar is a principal engineer's, on current TypeScript. Compiling is not the standard.

- No `any`: use `unknown` and narrow. No `!` non-null assertions. `as` only at a boundary that was just validated.
- Immutable by default: `const`, `readonly`, `ReadonlyArray` and `ReadonlyMap` in signatures, `as const`.
- Plain types and functions over classes, discriminated unions over class hierarchies. A class only when something
  needs identity or mutable state.
- No `enum` (`erasableSyntaxOnly` forbids it anyway). Literal unions and `as const` objects instead.
- Exhaustive `switch` with a `never` check. Guard clauses and early returns over nesting.
- Export only what another module uses.
- **Imports leave a folder through `@/`** (the tsconfig `paths` alias for `src/`, as Next.js documents it), never
  `../`; Oxlint rejects a parent-relative import (`import/no-relative-parent-imports`). Files in the same folder use
  `./`.
- **No barrel `index.ts` files.** Import the module that defines the thing. Vite's performance guide asks for this -
  a barrel makes Vite load and transform every file behind it - and it keeps server-only code (D1,
  `cloudflare:workers`) from being dragged into the browser bundle through a shared index.
- One concern per module, one component per file. Named exports, except where the framework requires a default
  export (pages, layouts, route files).
- A function with more than two optional parameters takes one options object instead.
- No floating promises and no `.then` chains.
- Validate configuration and bindings with a schema at startup.
- Fix a lint or type error properly. No `@ts-ignore`; `@ts-expect-error` only with a written reason. No blanket
  rule disables.
- No `Async` suffix on function names. It is a C# convention, not a TypeScript one.

## Linting and formatting

- **Oxlint** with type-aware rules from `oxlint-tsgolint`, which is built on the TS 7 compiler.
  `oxlint --type-aware --type-check` reports type errors in the same pass.
- **Stylelint** (`stylelint-config-standard-scss` plus `stylelint-declaration-strict-value`) keeps styles on the
  design system: colors, spacing, radius, type and z-index must come from a token function or a custom property.
  Only `src/shared/ui/styles/abstracts`, `src/shared/ui/styles/themes` and the reset may hold raw values. No hex or
  named colors, no `!important`, no ids, nesting at most 3 deep.
- **Sass guards tokens at build time:** `color(acent)` fails with the list of known roles.
- **Oxfmt** formats code, config and SCSS, sorting imports. It is in beta. Markdown is left out on purpose: docs
  are wrapped by hand at about 120 columns, and Oxfmt pads tables far past that.
- **`vendor/` is someone else's code**: Oxfmt, Oxlint and Vitest skip it.
- **CSS Module types** (`*.module.scss.d.ts`) are written by the dev server and the build, and committed. After
  changing a module's class names, run `pnpm dev` or `pnpm build` once so the types follow. Do not use the
  `vite-css-modules` CLI: it never exits, because Vite's Sass compiler outlives the run.

Run lint and fix what it reports before calling frontend work done.

## MCP servers and skills

| Source | What | Needs |
|---|---|---|
| `.agents/skills` | This repo's own procedures: `sign-in`, `d1-migrations`, `e2e-tests`, `design-system`, `cloudflare-and-vinext`, `security`. Read the matching one before such a task | nothing |
| `vendor/cloudflare/security-audit-skill` | Cloudflare's security-audit skill as a git submodule, pinned to a reviewed commit: the attack-class files the `security` skill points into. Read, never edited; Renovate moves the pin | `git submodule update --init` |
| `cloudflare` plugin | Cloudflare's skills, plus the Cloudflare API MCP server (`mcp.cloudflare.com`): API calls and current docs | OAuth sign-in on first use |
| `.mcp.json`: `chrome-devtools` | Driving the PWA in a real browser | nothing |
| `drizzle-kit` agent skills | How to run `generate`, read its JSON output, resolve its hints. Linked by pnpm into `.claude/skills/pnpm-drizzle-kit-*` and `.agents/skills/pnpm-drizzle-kit-*` (both ignored), always matching the installed drizzle-kit | approved in `pnpm-workspace.yaml` under `permissions` |

For vinext work, follow the plugin's `nextjs-on-cloudflare` skill, and Next.js's own docs
(https://nextjs.org/docs/llms.txt) for anything vinext does not list as different. `next-devtools-mcp` is left out
on purpose: its runtime tools need the Next.js dev server's `/_next/mcp` endpoint, which vinext does not have, and
its docs tool points at `node_modules/next`, which this project does not install.

## The one rule that governs the product

The user's alternative is a notes app, and the notes app always wins on speed. Anything that makes capture slower than
typing a line into notes will lose, no matter how good the rest is. Weigh every feature against that.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on workerd, with HMR |
| `pnpm build` | Production build into `.cloudflare/output`, pre-rendering static routes |
| `pnpm start` | Serve the production build locally |
| `pnpm typecheck` | Generate binding types, then `tsc` |
| `pnpm lint` | Oxlint, type-aware, then Stylelint |
| `pnpm format` / `pnpm format:check` | Oxfmt |
| `pnpm test` / `pnpm test:watch` | Vitest inside workerd, configured in `vitest.config.ts` |
| `pnpm test:e2e` | Specs from `e2e/*.feature`, then Playwright on three devices. Tests the last `pnpm build` |
| `pnpm icons` | Redraw the app icon from `scripts/generate-icons.ts` into `src/app/` and `public/icons/`. Commit the output |
| `pnpm symbols` | Write the UI icons listed in `scripts/generate-symbols.ts` into `src/shared/ui/icon/icons.tsx`. Commit the output |
| `pnpm access:account` | The first account and its setup link: `--username`, `--name`, `--origin`, then one of `--local`, `--remote`, `--dry-run` |
| `pnpm access:setup-link` | Break-glass recovery link for an account: `--username`, `--origin`, then one of `--local`, `--remote`, `--dry-run` |
| `pnpm access:revoke` | Ends every session of an account: `--username`, then one of `--local`, `--remote`, `--dry-run` |
| `pnpm notifications:keys` | A new Web Push key pair as JSON, for a deploy's `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` secrets. Only when asked |
| `pnpm db:generate` | Generate a migration from the `*.table.ts` files |
| `pnpm db:migrate` | Apply migrations to the local D1 the dev server uses |
| `pnpm run deploy` | Deploy to Cloudflare. Only when asked. `pnpm deploy` is pnpm's own command, not this script |

Before calling a change done: `format:check`, `lint`, `typecheck`, `test` and `build` all pass. When a screen
changed, `test:e2e` too, after `build`.

## CI

`.github/workflows/ci.yml` runs on every pull request and on `main`, in two jobs side by side:

- `check`: `pnpm audit`, the five commands above, then a check that the committed `*.module.scss.d.ts` files match
  what the build wrote.
- `e2e`: installs Chromium (without the headless shell) and WebKit, builds, runs `pnpm test:e2e`. When it fails, the
  Playwright report, traces included, is kept as an artifact for 14 days.

Actions are pinned to commit SHAs with the version in a comment; bump both together. `pnpm/setup` installs pnpm
from `packageManager`, Node from `.node-version`, and runs a frozen install.

Two more workflows run on pull requests: `conventional-commits.yml` checks the title, and `dependency-review.yml`
fails a PR that adds a dependency with a known vulnerability.

### Dependencies

Renovate (`.github/renovate.json5`) opens update PRs on Monday mornings, security fixes at any time, and keeps SHA
and version comment in step. Dependabot only raises alerts.

GitHub's dependency graph reads only the first YAML document of `pnpm-lock.yaml`, the one pnpm 12 writes to install
pnpm itself: its SBOM lists pnpm's own packages and none of the app's. Dependabot alerts and dependency review
therefore see `package.json` and never a transitive package. `pnpm audit` in `check` covers the whole tree. An
advisory that cannot be fixed goes in `audit.ignore` in `pnpm-workspace.yaml` with a one-line reason, and comes out
once a fix lands.

## Style

- ASCII punctuation only, in code, comments, commit messages and docs. Hyphens, never en or em dashes.
- Vietnamese in product copy is written with full diacritics. The bot talks to a Vietnamese user.
- Comments explain why, not what. One line where one line does.

## Commits

Conventional Commits. No AI attribution lines, no co-author trailers.

## Docs

`docs/product/design.md` is the product design and is kept current. When a decision in it is reversed, edit the file and
say why it changed - the reasoning is the valuable part, not the conclusion.
