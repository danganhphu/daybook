# Copilot instructions

All development guidelines for this repo live in [AGENTS.md](../AGENTS.md): conventions, commands, project layout and
the rules for sign-in. Read it first.

Task-specific procedures live in [`.agents/skills`](../.agents/skills), one folder per skill. Read the matching one
before such a task:

- **`sign-in`** - no secret is stored as itself, only an authenticating use case opens a session, security settings
  check step-up in the use case.
- **`d1-migrations`** - Drizzle cannot emit STRICT or triggers; they are added by hand and guarded by schema tests.
- **`e2e-tests`** - what an end-to-end assertion has to wait for, and the browser traps already hit.
- **`design-system`** - tokens only through the Sass functions, no `className` on components, mobile first.
- **`cloudflare-and-vinext`** - `cf` rather than Wrangler, and where vinext differs from Next.js.

Three rules that cause most of the churn if missed:

1. ASCII punctuation in code, comments and commit messages - hyphens and straight quotes, no em dash, no ellipsis
   character. Vietnamese copy keeps its full diacritics.
2. Conventional Commits, and nothing else in the trailer.
3. Imports leave a folder through `@/`, never `../`, and there are no barrel files.
