# Commands

Every script in `package.json`. Run them from the repository root.

## Develop and build

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:5173, on workerd, with hot reload |
| `pnpm build` | Production build into `.cloudflare/output` |
| `pnpm start` | Serve the production build locally; needs `APP_ORIGIN` and `PASSWORD_PEPPER` ([configuration](configuration.md)) |
| `pnpm icons` | Redraw the app icon from `scripts/generate-icons.ts` into `src/app/` and `public/icons/`; commit the output |
| `pnpm symbols` | Write the UI icons listed in `scripts/generate-symbols.ts` into `src/shared/ui/icon/icons.tsx` ([icons](../ui/design-system.md#icons)); commit the output |
| `pnpm deploy` | Deploy the Worker. Not done yet; see [deployment](deployment.md) |

## Check

| Command | Does |
| --- | --- |
| `pnpm typecheck` | Generate the binding types into `.cloudflare/types`, then `tsc` (TypeScript 7) |
| `pnpm lint` | Oxlint, type-aware, then Stylelint over every `.scss` |
| `pnpm format` / `pnpm format:check` | Oxfmt: format, or only check |
| `pnpm test` / `pnpm test:watch` | Vitest inside workerd, once or watching |
| `pnpm test:e2e` | Playwright on three devices, against the last `pnpm build` ([testing](testing.md)) |

## Database

| Command | Does |
| --- | --- |
| `pnpm db:generate --name <what_it_does>` | A migration from the `*.table.ts` files ([database](database.md)) |
| `pnpm db:migrate` | Apply migrations to the local database |

## Account commands

For the two moments the app cannot help: the first account, and when nobody can sign in. Everyday account work -
invites, recovery links, passwords, usernames - is in the app's settings.

Each takes exactly one of:

- `--local` - the dev database. Stop `pnpm dev` first.
- `--remote` - the production database on Cloudflare. A real change to the live app.
- `--dry-run` - print the SQL it would send, change nothing.

| Command | Does |
| --- | --- |
| `pnpm access:account --username <name> --name "<display name>" --origin <app URL>` | Create an account and print its setup link |
| `pnpm access:setup-link --username <name> --origin <app URL>` | Print a recovery link for an account. Using it adds a passkey and signs the account out everywhere else |
| `pnpm access:revoke --username <name>` | Sign an account out on every device |

Examples, with an invented account:

```sh
pnpm access:account --username lan --name "Lan" --origin http://localhost:5173 --local
pnpm access:setup-link --username lan --origin https://daybook.example.workers.dev --dry-run
pnpm access:revoke --username lan --remote
```

A link is shown once and works once, for ten minutes; only its hash is stored. The commands run the app's own use
cases (`src/composition/operator-console.ts`), so they keep every rule the app keeps and log to `access_event` like it.

## Cloudflare CLI

The project uses `cf` (`pnpm exec cf ...`) and its typed `cloudflare.config.ts`, not Wrangler. To find a command,
`pnpm exec cf cli search "<what you want to do>"`. For the few things `cf` cannot do yet, Wrangler runs through
`npx` without joining the project, for example `npx wrangler tail daybook`.
