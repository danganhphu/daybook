# Development

## The dev server

```sh
pnpm dev
```

Opens on http://localhost:5173 with hot reload, on workerd (the Workers runtime) and the local D1 from
[installation](installation.md#the-local-database). The port is fixed: passkeys belong to an exact origin, so a busy
port is an error rather than a quiet move to the next one.

- **Sign in with Chrome or Edge.** The session cookie is `__Host-` and therefore `Secure`; Chromium keeps it on
  `http://localhost`, Safari does not. The end-to-end tests cover WebKit over HTTPS instead.
- **`/dev/ui`** shows every component of the design system in every state. It answers 404 in production.
- **No secrets are needed.** In development, `APP_ORIGIN` and `PASSWORD_PEPPER` have fixed values in
  `cloudflare.config.ts`; see [configuration](../guides/configuration.md).
- The dev server writes the typed `*.module.scss.d.ts` beside each style module. They are committed; after changing
  class names, let the dev server or a build run once.

## The production build, locally

```sh
pnpm build
```

writes the Worker to `.cloudflare/output`. To serve it, give it the two values a deployed Worker reads from its
secrets (any 32 random bytes will do for the pepper):

```sh
# bash
APP_ORIGIN=http://localhost:4173 \
PASSWORD_PEPPER=$(node -e "console.log(crypto.randomBytes(32).toString('base64url'))") \
pnpm start
```

```powershell
# PowerShell
$env:APP_ORIGIN = "http://localhost:4173"
$env:PASSWORD_PEPPER = node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
pnpm start
```

This is what the end-to-end tests run, on HTTPS and a database of their own; see [testing](../guides/testing.md).

## Before calling a change done

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e      # when a screen changed
```

CI runs the same on every pull request. Conventions - layout, naming, errors, tests - are in
[AGENTS.md](../../AGENTS.md).

## Editors

- **VS Code:** install what `.vscode/extensions.json` recommends - TypeScript 7 (`TypeScriptTeam.native-preview`),
  Oxc, Stylelint, EditorConfig - and disable Prettier, ESLint and Tailwind IntelliSense for this workspace.
- **Claude Code:** trust the folder. `.claude/settings.json` enables Cloudflare's plugin; the repo's own procedures
  are in `.agents/skills/`.
