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
   - take out drizzle-kit's `PRAGMA foreign_keys=OFF/ON` pair (it does nothing in D1, below),
   - a header comment naming what was hand-edited.
   Where drizzle-kit rebuilds a table only to add a column with its check, write `ALTER TABLE ... ADD ... CONSTRAINT
   ... CHECK(...)` instead: SQLite tests the check against the rows already there. A rule across tables is a new
   trigger, which needs no rebuild (`20261102035854_audit_fixes`).
4. Extend the schema test beside the feature's tables (`*-schema.test.ts`): text in an integer column refused, each
   new check and trigger refusing what it should. `src/shared/infrastructure/d1/migrations.test.ts` already puts a
   book written by the app through each of the newest migrations; add a row of what the new migration touches to its
   `writeBook` when nothing there has one.
5. `pnpm db:migrate` applies it to the dev database. Tests apply every migration to an empty database before each test.

Removing a table or a column waits one release after the code stops using it: the version running while the
migration is applied, and the one a rollback returns to, still read it. A migration that breaks rollback says so in
its header.

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
