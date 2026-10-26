---
name: d1-migrations
description: How to change the D1 schema here - Drizzle table files, drizzle-kit generate, the hand edits Drizzle cannot emit (STRICT, triggers), the schema tests that guard them, and applying migrations locally. Use this before editing a *.table.ts file or anything under migrations/.
---

# Changing the schema

Tables live in each feature's `infrastructure/*.table.ts`. Migrations are generated, then edited by hand.

## Steps

1. Edit the table file. Rules that matter go in `check(...)` too, not only in code.
2. `pnpm exec drizzle-kit generate --output json --name <what_it_does>` - the drizzle-kit skills under `.claude/skills`
   explain the envelope and the `missing_hints` loop.
3. Open `migrations/<timestamp>_<name>/migration.sql` and add by hand:
   - `STRICT` after every `CREATE TABLE (...)`,
   - triggers - `capture` and `access_event` are append-only; a `setup_link` is redeemed once,
   - a header comment naming what was hand-edited.
4. Extend the schema test for the feature (`src/shared/infrastructure/d1/schema.test.ts`,
   `src/features/access/infrastructure/access-schema.test.ts`): text in an integer column refused, each new check and
   trigger refusing what it should.
5. `pnpm db:migrate` applies it to the dev database. Tests apply every migration to an empty database before each test.

## Traps

- **A rebuild drops the hand edits.** When drizzle-kit rebuilds a table (a changed check, a new NOT NULL column), the
  new `CREATE TABLE` has no `STRICT` and the triggers are gone. Its snapshot never knew them. The schema tests catch it;
  re-add them.
- **A rebuild of a table others point at runs their `ON DELETE` actions.** D1 keeps foreign keys on inside a
  migration, so drizzle-kit's `PRAGMA foreign_keys=OFF` does nothing and its `DROP TABLE` sets every `ON DELETE SET
  NULL` reference to null; `defer_foreign_keys` does not stop it. Hold the references aside and put them back after
  the rename, as `20261026082733_passkey_es256_and_ed25519_only` does, and try it on seeded rows first.
- A migration that is already applied anywhere real is never edited. Before the first deploy, regenerating a migration
  made on the current branch is fine.
- `cf d1 migrations apply` needs `--persist-to .cloudflare/state`; without it, cf writes to a store every project
  shares. The end-to-end tests use `.cloudflare/e2e-state`.
- Remote migrations reach the live database. Only when asked.
