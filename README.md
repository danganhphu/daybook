# daybook

[![ci](https://github.com/danganhphu/daybook/actions/workflows/ci.yml/badge.svg)](https://github.com/danganhphu/daybook/actions/workflows/ci.yml)

A notebook for a salesperson on the move: orders, customers and follow-ups, typed the way you would text a friend.
A Telegram bot is the main way in; a web app, installable as a PWA, is the second. Both run on one Cloudflare Worker,
on the free plan. The interface is in Vietnamese.

| Sign in | Today | Settings | Invited |
| --- | --- | --- | --- |
| ![Sign-in screen](docs/images/sign-in.png) | ![Today's notes](docs/images/today.png) | ![Settings](docs/images/settings.png) | ![Naming an invited account](docs/images/invite.png) |

## Features

- **Quick capture.** Today's notes as a chat: type, send, saved at once. Edit in place, delete with one tap and Undo.
- **Installable.** Adds to a phone's home screen as an app, with its own icon.
- **Passkeys.** Sign in with Face ID or a fingerprint; a password is the fallback, hashed with Argon2id in the
  browser and checked against known breaches.
- **Two people, one book.** No roles. Invites and recovery links from inside the app, shown once, valid ten minutes.
- **Settings.** Name and username, passkeys, the password, signed-in devices, recent activity. Security settings ask
  to confirm again.
- **Accessible.** Every screen is checked against WCAG 2.2 AA on an iPhone, an Android phone and a desktop.

**Status:** early, and not deployed yet. The Telegram bot, parsing messages into orders and reminders, and the
first deploy come next.

## Quick start

Node 26 and pnpm 12, then:

```sh
pnpm install
pnpm exec cf auth login     # once; opens a browser
pnpm db:migrate
pnpm access:account --username lan --name "Lan" --origin http://localhost:5173 --local
pnpm dev
```

Open the printed link in Chrome or Edge to turn on a passkey, then http://localhost:5173. The details, and the
one-time setup for Cloudflare and the test browsers, are in [installation](docs/getting-started/installation.md).

## Documentation

| | |
| --- | --- |
| Getting started | [Installation](docs/getting-started/installation.md), [development](docs/getting-started/development.md) |
| Guides | [Configuration](docs/guides/configuration.md), [commands](docs/guides/commands.md), [testing](docs/guides/testing.md), [database](docs/guides/database.md), [deployment](docs/guides/deployment.md), [troubleshooting](docs/guides/troubleshooting.md) |
| Product and design | [Product design](docs/product/design.md), [design system](docs/ui/design-system.md) |
| Architecture | [Overview](docs/architecture/overview.md), [domain](docs/architecture/domain.md) |
| Conventions | [AGENTS.md](AGENTS.md), for people and coding agents alike |

All of it: [docs/README.md](docs/README.md).

## Stack

TypeScript 7, [vinext](https://github.com/cloudflare/vinext) (the Next.js API on Vite) on Cloudflare Workers, D1
through Drizzle ORM, Zod, Base UI under a design system written in SCSS, SimpleWebAuthn for passkeys. Tests: Vitest
inside workerd, Playwright with playwright-bdd and axe. Tooling: pnpm, Oxlint, Oxfmt, Stylelint, the `cf` CLI.

## Contributing

A personal project with one maintainer; outside pull requests are not expected.

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

None. The source is public to read; all rights are reserved.
