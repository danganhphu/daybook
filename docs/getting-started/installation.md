# Installation

From a fresh clone to a running app with a first account, on Windows, macOS or Linux.

## What you need

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 26 | `.node-version` pins it for nvm, fnm and Volta |
| pnpm | 12 | Installed on its own: Node 26 no longer ships Corepack. See https://pnpm.io/installation. The exact version is in `package.json` (`packageManager`) |
| Git | any recent | |
| A browser with passkeys | Chrome or Edge for local work | Safari drops `Secure` cookies on `http://localhost`, see [development](development.md) |
| A Cloudflare account | free plan, no card | Only for what reaches Cloudflare: deploys and `--remote` commands |

## Install

```sh
git clone https://github.com/danganhphu/daybook.git
cd daybook
pnpm install
```

`pnpm install` follows the supply-chain rules in `pnpm-workspace.yaml`: versions are pinned exactly, a release
younger than a day is not installed, a drop in a package's publish trust fails the install, and only packages listed
under `allowBuilds` may run install scripts.

Then, once per machine:

```sh
pnpm exec cf auth login                        # signs this machine in to Cloudflare; opens a browser
pnpm exec playwright install chromium webkit   # browsers for the end-to-end tests; add --with-deps on Linux
```

## The local database

```sh
pnpm db:migrate
```

This creates the D1 database the dev server uses, as a SQLite file in `.cloudflare/state`, and applies every
migration in `migrations/`. Run it again after pulling a change that adds a migration. Nothing here touches the
database on Cloudflare.

## The first account

Nobody signs up. The first account comes from the command line, with a setup link to turn on Face ID or a
fingerprint (Windows Hello on a PC):

```sh
pnpm access:account --username lan --name "Lan" --origin http://localhost:5173 --local
```

- Stop `pnpm dev` first: `--local` writes to the dev database's file directly.
- The command prints a link that works once, for ten minutes. Open it in Chrome or Edge and press "Bật ngay".
- From then on, everything else is in the app's settings: inviting the second person, recovery links, the fallback
  password, usernames. See [commands](../guides/commands.md#account-commands) for the other account commands.

Next: [development](development.md).
