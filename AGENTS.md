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

Scaffolded: an empty vinext app that type-checks, lints, builds and runs locally. No features yet.

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
| Components | shadcn/ui, `base-nova` style on Base UI, Tailwind CSS 4 |
| Font | Inter with the `vietnamese` subset. Geist, shadcn's default, has no Vietnamese glyphs |
| Browser-side server state | TanStack Query, once a screen needs client caching or optimistic updates. Not SWR: same job, less for mutations |
| Client state | None until something needs it, then Zustand. Not Redux Toolkit: far more machinery than one user needs |
| Tables | TanStack Table, through shadcn's data table |
| Cloudflare CLI | `cf` with a typed `cloudflare.config.ts`. Not Wrangler |
| Database | D1, through Drizzle ORM (1.0 release candidate, pinned to an exact version) |
| Validation | Zod 4. One schema drives input validation, the LLM's `response_format` and the check on what it returns |
| LLM | Workers AI binding, with Groq as the fallback |
| Telegram | grammY in webhook mode, verified with `secret_token` |
| Tests | Vitest 5 with `@cloudflare/vitest-plugin` |
| Language | TypeScript 7 |
| Tooling runtime | Node 26 |
| Package manager | pnpm |
| Lint and format | Oxlint (type-aware) with `@shadcn/lint`, and Oxfmt |

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

## Setup

- Node 26 and pnpm. `.node-version` pins Node for version managers that read it; the pnpm version is pinned in
  `package.json`. Node no longer ships Corepack, so install pnpm itself once - see https://pnpm.io/installation.
- `pnpm install`. `pnpm-workspace.yaml` holds the supply-chain settings: new releases wait a day, a drop in publish
  trust fails the install, and dependency build scripts run only for packages listed under `allowBuilds`. Review a
  package before adding it there. Versions are pinned exactly.
- `pnpm exec cf auth login`. It opens a browser to approve access, so a person does it, not an agent.
- Claude Code: trust the folder when asked. `.claude/settings.json` declares the `cloudflare/skills` marketplace
  and enables its `cloudflare` plugin, which brings Cloudflare's skills and the Cloudflare MCP server. If Claude
  Code reports it as enabled but not installed, run `claude plugin install cloudflare@cloudflare --scope project`.
- VS Code: install the TypeScript 7 extension (`TypeScriptTeam.native-preview`) until VS Code bundles it.

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
- Export only what another module uses. No barrel files.
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
- **`@shadcn/lint`** runs inside Oxlint as a JS plugin. It is given the allowed styling rules and reports
  violations against the project's own components and theme. Oxlint's JS plugins are still alpha, with a known
  out-of-memory problem on Windows; if that bites, run lint under WSL.
- **Oxfmt** formats code and config, sorting imports and Tailwind classes. It is in beta. Markdown is left out on
  purpose: docs are wrapped by hand at about 120 columns, and Oxfmt pads tables far past that.
- All six `@shadcn/lint` rules are errors, by the owner's choice: no restyling a component through `className`, no
  raw palette colors, no arbitrary values, no inline styles, no classes Tailwind cannot generate, no dynamically
  built classes on a component. A design need the theme cannot express goes into the theme or a variant. Until
  the first component exists, it warns that `@/components/ui` does not resolve; that is expected.

Run lint and fix what it reports before calling frontend work done.

## MCP servers and skills

| Source | What | Needs |
|---|---|---|
| `cloudflare` plugin | Cloudflare's skills, plus the Cloudflare API MCP server (`mcp.cloudflare.com`): API calls and current docs | OAuth sign-in on first use |
| `.mcp.json`: `shadcn` | The component registry | a `components.json` |
| `.mcp.json`: `chrome-devtools` | Driving the PWA in a real browser | nothing |

For vinext work, follow the plugin's `nextjs-on-cloudflare` skill. `next-devtools-mcp` is left out on purpose: it
talks to the Next.js dev server's own MCP endpoint, which vinext does not have.

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
| `pnpm lint` | Oxlint, type-aware |
| `pnpm format` / `pnpm format:check` | Oxfmt |
| `pnpm deploy` | Deploy to Cloudflare. Only when asked |

Before calling a change done: `format:check`, `lint`, `typecheck` and `build` all pass. There is no test runner
yet; it arrives with the first feature worth testing.

## Style

- ASCII punctuation only, in code, comments, commit messages and docs. Hyphens, never en or em dashes.
- Vietnamese in product copy is written with full diacritics. The bot talks to a Vietnamese user.
- Comments explain why, not what. One line where one line does.

## Commits

Conventional Commits. No AI attribution lines, no co-author trailers.

## Docs

`docs/design.md` is the product design and is kept current. When a decision in it is reversed, edit the file and
say why it changed - the reasoning is the valuable part, not the conclusion.
