# daybook

[![ci](https://github.com/danganhphu/daybook/actions/workflows/ci.yml/badge.svg)](https://github.com/danganhphu/daybook/actions/workflows/ci.yml)

A notebook for a salesperson on the move: orders, customers and follow-ups, typed the way you would text a friend.
A Telegram bot is the main way in; a web app, installable as a PWA, is the second. Both run on one Cloudflare Worker,
on the free plan.

**Status:** early. The web app records, edits and deletes notes, with Undo, and installs to a phone's home screen.
Sign-in is being built. Nothing is deployed yet.

## Stack

TypeScript 7, [vinext](https://github.com/cloudflare/vinext) (the Next.js API on Vite) on Cloudflare Workers, D1
through Drizzle, Base UI under a design system written in SCSS. Tests: Vitest inside workerd, and Playwright with
playwright-bdd and axe on an iPhone, an Android phone and a desktop.

## Run it

Node 26 and pnpm 12.

```sh
pnpm install
pnpm exec cf auth login                        # once; opens a browser
pnpm exec playwright install chromium webkit   # once, for the end-to-end tests
pnpm db:migrate                                # the local database
pnpm dev
```

Before a change is done: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e` when a screen changed.

## Read next

- [docs/design.md](docs/design.md) - what the product does and why
- [docs/domain.md](docs/domain.md) - the data model and its rules
- [docs/ui.md](docs/ui.md) - the design system
- [AGENTS.md](AGENTS.md) - conventions, commands and layout, for people and coding agents alike

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

None. The source is public to read; all rights are reserved.
