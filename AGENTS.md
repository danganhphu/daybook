# AGENTS.md

## What this is

A personal tool that helps one salesperson keep track of her own work. She sells dental supplies to clinics: she
takes orders on the road, by phone and over chat, and today she keeps all of it in a notes app and forgets half
of it.

Telegram is the main way in, because she already lives in it. A PWA covers the things chat is bad at - correcting
an old entry, browsing, reading numbers off a table. Both are thin adapters over one core.

The design is in [docs/design.md](docs/design.md). Read it before proposing changes to the interaction model; the
decisions in it have reasons attached, and several of them are deliberate reversals of the obvious choice.

## Status

Quick capture works locally: `/` is today's notes as a chat - the box at the bottom, saved the moment she sends,
editable in place, deleted with one tap and an Undo, and covered end to end on a phone and a desktop. It installs
to a phone's home screen as an app (a manifest and icons; no service worker yet). Sign-in is being built: the access
core - accounts, sessions, setup links, the audit trail - exists without a screen yet. Nothing is deployed; sign-in
comes before the first deploy.

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
| 5 Cron Triggers per account, UTC only | 07:30 in Vietnam is `30 0 * * *`. Write day names (`FRI`): in Cloudflare's numbering 1 is Sunday |

## Stack

| Concern | Choice |
|---|---|
| Platform | One Cloudflare Worker serving the PWA, the Telegram webhook and the cron jobs |
| Web | [vinext](https://github.com/cloudflare/vinext): the Next.js 16 API on Vite, built for Workers. Next.js App Router conventions apply, but parity is not complete - check vinext's compatibility notes before using an uncommon Next feature |
| Components | Base UI for behavior and accessibility; our own design system on top, in SCSS. See [docs/ui.md](docs/ui.md) |
| Styling | Sass (`sass-embedded`) as CSS Modules beside each component, tokens in `src/shared/ui/styles/`. Not Tailwind: Tailwind 4 is not built to sit beside a preprocessor |
| Icons | lucide-react |
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
- **The Worker entry routes the bot before vinext.** The Telegram webhook path is handled in the custom Worker
  entry, so a bot message never pays for React rendering. Everything else is handed to vinext's fetch handler.
  The same entry exports `scheduled` for the morning digest and the Friday summary.
- **The webhook answers fast.** Long work - the LLM call - goes into `ctx.waitUntil`, which allows 30 seconds.
- **Never lose her words.** Every message is stored verbatim in `capture` before anything else happens, including
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
    capture/      her words coming in: the Capture aggregate, recordCapture
    notes/        the notes she keeps: the Note aggregate, edit, delete, restore, the day's list
                  (later: orders/, reminders/, customers/ - one folder per feature)
  shared/
    domain/       Result, Content, the Vietnamese day
    application/  Clock, the UnitOfWork type
    infrastructure/  the D1 client and batch, the system clock, the schema tests
    ui/           the design system: components and styles/
  composition/    createApp and the unit of work: the one place that wires everything together
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
- The model, its vocabulary and its rules are in [docs/domain.md](docs/domain.md). Propose a change to the data
  model there before writing it.

## Errors

- **An outcome she can cause is a `Result`** (`src/shared/domain/result.ts`): a note that is gone, editing a
  deleted note. The error is a code from the feature's closed set (`NoteError` in
  `src/features/notes/application/note-errors.ts`), and each use case narrows its return type to the codes it can
  produce, so a caller handles exactly those.
- **A fault throws**: D1 unreachable, a constraint the code should have prevented, a bug. Nothing below the adapter
  catches it.
- The reason is that a signature then says what can go wrong. Not speed: a throw costs microseconds next to a
  network round trip.
- **No Maybe type.** `T | undefined` under strict null checks is the Maybe, and the compiler checks it. No `null`
  in domain types; it stays in the row mapping.
- **Every code has the sentence she sees** in the feature's messages (`noteErrorMessages`), and
  `satisfies Record<NoteError, string>` fails the build if one is missing. Adapters show these; they do not word
  their own.

## Access

Two people share one book and sign in with passkeys, a password being the fallback; `docs/design.md` "Đăng nhập" says
why, `docs/domain.md` "Access" has the rules in full. What code must never get wrong:

- **No secret is stored, logged or put in a query string as itself.** Session secrets, setup tokens and ceremony
  bindings are 256 random bits from `Secrets`; only their SHA-256 reaches D1, and presented secrets are checked with
  `secretTokenMatches` (constant time). A setup token travels in a URL fragment and reaches the server in a POST body.
- **Only a use case that has just authenticated someone opens a session**, through `enlistNewSession` on its own unit
  of work. No adapter calls it, and nothing exposes it on the `App`.
- **Security settings check step-up in the use case** (`Sessions.isFresh`), not only in the screen.
- **Every access attempt is recorded** in `access_event`, successes and refusals alike. Never a token, secret,
  challenge, credential response or derived key in it; the session id is the public half of a cookie and may appear.
- **Rate limits count a client**, an IPv4 address or an IPv6 /64, in D1 (`createRateLimiter`), exact rather than the
  approximate per-location binding.
- **The command line is for two moments only**: the first account, and break-glass (`pnpm access:*`, below). It runs
  the app's own use cases and writes against a batch that records SQL, and sends that through `cf d1 query`, which has
  no local mode - so `--remote` or `--dry-run`.

## Database

- **D1, one database** (`daybook`, APAC), bound as `DB` in `cloudflare.config.ts` with its real id.
- **Writes go through a unit of work.** D1 has no interactive transactions, but a batch is atomic: a use case
  queues its changes and `commit()` sends them as one batch, all or none. Repositories only read.
- **Schema change:** edit the feature's `infrastructure/*.table.ts`, run `pnpm db:generate --name <what_it_does>`, read
  the generated `migrations/<timestamp>_<name>/migration.sql`, add what Drizzle cannot emit (below), then
  `pnpm db:migrate` to apply it to the local database the dev server uses. The drizzle-kit skills cover the commands.
- **Added by hand: `STRICT` on every table, and the triggers** that make `capture` and `access_event` append-only and
  let a `setup_link` be redeemed once. Drizzle cannot emit either and its snapshot does not know about them, so a
  migration that rebuilds a table drops them silently. `src/shared/infrastructure/d1/schema.test.ts` and
  `src/features/access/infrastructure/access-schema.test.ts` fail when that happens. Say what was hand-edited at the
  top of the file.
- **Rules that matter are kept by the database too**, not only by code: `CHECK` for known values and non-blank
  content, foreign keys, the triggers.
- **`capture` is never updated or deleted**, by code or by hand. Corrections go to the note.
- **Anything derived from a capture keeps its `capture_id`**, so every record traces back to what she typed.
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

End-to-end tests cover the flows she would notice breaking; everything else is a Vitest test.

- **Scenarios are Gherkin** in `e2e/*.feature`, with English keywords and Vietnamese steps, run by Playwright
  through playwright-bdd on an iPhone (WebKit), an Android phone (Chromium) and desktop Chrome. Tag a scenario
  `@desktop-only` or `@phone-only` when the devices behave differently, like what Enter does, and `@chromium-only`
  when it asks Chrome itself over the DevTools protocol.
- **Chromium is real Chrome** in its new headless mode (`channel: "chromium"`). Playwright's default headless shell
  is not full Chrome: asked whether a page installs, it reports no errors even for a page with no manifest.
- **They run the production build** on a D1 of their own in `.cloudflare/e2e-state`: `e2e/serve.ts` empties and
  migrates it, then serves `pnpm build`'s output, so the dev database is never touched. Each scenario starts by
  emptying the day through the screen, which is why they run one at a time.
- **Find things the way she does**: by role and by the words on screen, never by class name or test id. The screen
  is described once, in `e2e/today-page.ts`.
- **A screen is checked with axe** against WCAG 2.2 A and AA, in the step `trang không có lỗi trợ năng`. It lets
  running animations finish first: axe measures colour as painted, so a toast still fading in fails contrast.
- `bddgen` writes the specs into `.features-gen/`, which is gitignored and skipped by Vitest.

## Setup

- Node 26 and pnpm. `.node-version` pins Node for version managers that read it; the pnpm version is pinned in
  `package.json`. Node no longer ships Corepack, so install pnpm itself once - see https://pnpm.io/installation.
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
- **CSS Module types** (`*.module.scss.d.ts`) are written by the dev server and the build, and committed. After
  changing a module's class names, run `pnpm dev` or `pnpm build` once so the types follow. Do not use the
  `vite-css-modules` CLI: it never exits, because Vite's Sass compiler outlives the run.

Run lint and fix what it reports before calling frontend work done.

## MCP servers and skills

| Source | What | Needs |
|---|---|---|
| `cloudflare` plugin | Cloudflare's skills, plus the Cloudflare API MCP server (`mcp.cloudflare.com`): API calls and current docs | OAuth sign-in on first use |
| `.mcp.json`: `chrome-devtools` | Driving the PWA in a real browser | nothing |
| `drizzle-kit` agent skills | How to run `generate`, read its JSON output, resolve its hints. Linked by pnpm into `.claude/skills/pnpm-drizzle-kit-*`, always matching the installed drizzle-kit | approved in `pnpm-workspace.yaml` under `permissions` |

For vinext work, follow the plugin's `nextjs-on-cloudflare` skill, and Next.js's own docs
(https://nextjs.org/docs/llms.txt) for anything vinext does not list as different. `next-devtools-mcp` is left out
on purpose: its runtime tools need the Next.js dev server's `/_next/mcp` endpoint, which vinext does not have, and
its docs tool points at `node_modules/next`, which this project does not install.

## The one rule that governs the product

Her alternative is a notes app, and the notes app always wins on speed. Anything that makes capture slower than
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
| `pnpm access:account` | The first account and its setup link: `--username`, `--name`, `--origin`, then `--remote` or `--dry-run` |
| `pnpm access:setup-link` | Break-glass recovery link for an account: `--username`, `--origin`, `--remote` or `--dry-run` |
| `pnpm access:revoke` | Ends every session of an account: `--username`, `--remote` or `--dry-run` |
| `pnpm db:generate` | Generate a migration from the `*.table.ts` files |
| `pnpm db:migrate` | Apply migrations to the local D1 the dev server uses |
| `pnpm deploy` | Deploy to Cloudflare. Only when asked |

Before calling a change done: `format:check`, `lint`, `typecheck`, `test` and `build` all pass. When a screen
changed, `test:e2e` too, after `build`.

## CI

`.github/workflows/ci.yml` runs on every pull request and on `main`, in two jobs side by side:

- `check`: the five commands above, then a check that the committed `*.module.scss.d.ts` files match what the
  build wrote.
- `e2e`: installs Chromium (without the headless shell) and WebKit, builds, runs `pnpm test:e2e`. When it fails, the Playwright report, traces
  included, is kept as an artifact for 14 days.

Actions are pinned to commit SHAs with the version in a comment; bump both together. `pnpm/setup` installs pnpm
from `packageManager`, Node from `.node-version`, and runs a frozen install.

## Style

- ASCII punctuation only, in code, comments, commit messages and docs. Hyphens, never en or em dashes.
- Vietnamese in product copy is written with full diacritics. The bot talks to a Vietnamese user.
- Comments explain why, not what. One line where one line does.

## Commits

Conventional Commits. No AI attribution lines, no co-author trailers.

## Docs

`docs/design.md` is the product design and is kept current. When a decision in it is reversed, edit the file and
say why it changed - the reasoning is the valuable part, not the conclusion.
