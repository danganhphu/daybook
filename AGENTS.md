# AGENTS.md

## What this is

A personal tool that helps one salesperson keep track of her own work. She sells dental supplies to clinics: she
takes orders on the road, by phone and over chat, and today she keeps all of it in a notes app and forgets half
of it.

Telegram is the main way in, because she already lives in it. A PWA covers the things chat is bad at - correcting
an old entry, browsing, reading numbers off a table. Both are thin clients over one API.

The design is in [docs/design.md](docs/design.md). Read it before proposing changes to the interaction model; the
decisions in it have reasons attached, and several of them are deliberate reversals of the obvious choice.

## Status

Nothing is built yet.

Settled so far:

- **Aspire** is the local orchestrator, running the frontend and the backend together under one AppHost. That
  fixes the backend to .NET.
- **Next.js** for the frontend, with **shadcn/ui** for components and **`@shadcn/lint`** policing the Tailwind
  usage.

Still open: where the Telegram bot lives, and which database.

Do not scaffold an application until the rest of that is agreed.

## Setup

Aspire's agent skills are installed, not committed: they ship inside the Aspire CLI and are version matched to it,
so a vendored copy drifts the moment anyone updates. Run this after cloning, and again after `aspire update --self`:

```powershell
aspire agent init --skills all --skill-locations claudecode
```

## MCP servers

`.mcp.json` registers five. Three of them only become useful once the application exists, which is worth knowing
before you wonder why a tool returns nothing:

| Server | Needs |
|---|---|
| `aspire` | an AppHost in the repo |
| `next-devtools` | Next.js 16 or later **and a dev server actually running**. It reads the live app - errors, routes, logs, compilation issues - rather than the source |
| `shadcn` | a `components.json` in the project |
| `microsoft-learn` | nothing. Use it for .NET questions instead of guessing |
| `chrome-devtools` | nothing. For driving the PWA in a real browser |

The Next.js MCP endpoint at `/_next/mcp` is on by default in Next 16. If it ever needs turning off, that is
`experimental.mcpServer: false` in `next.config`.

## Linting

`@shadcn/lint` is an agent-first linter for Tailwind design systems: it is given the allowed styling rules and
reports violations against the project's own components and theme. It is not an MCP server - it runs as a lint
command. Set it up by pointing an agent at `https://github.com/shadcn-ui/lint/blob/main/SETUP.md`, then wire the
command into `package.json` as `lint`.

Needs Node 20.19+, and either ESLint 9.30+ or Oxlint 1.80+.

Run lint and fix what it reports before calling frontend work done.

## The one rule that governs the product

Her alternative is a notes app, and the notes app always wins on speed. Anything that makes capture slower than
typing a line into notes will lose, no matter how good the rest is. Weigh every feature against that.

## Commands

None yet. This section gets filled in when the stack lands.

## Style

- ASCII punctuation only, in code, comments, commit messages and docs. Hyphens, never en or em dashes.
- Vietnamese in product copy is written with full diacritics. The bot talks to a Vietnamese user.
- Comments explain why, not what. One line where one line does.

## Commits

Conventional Commits. No AI attribution lines, no co-author trailers.

## Docs

`docs/design.md` is the product design and is kept current. When a decision in it is reversed, edit the file and
say why it changed - the reasoning is the valuable part, not the conclusion.
