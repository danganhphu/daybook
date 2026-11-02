# Database

One D1 database, `daybook`, accessed through Drizzle ORM. The model, its vocabulary and its rules are in
[domain.md](../architecture/domain.md); this page is how to change it.

## Changing the schema

1. Edit the feature's table file, `src/features/<feature>/infrastructure/*.table.ts`.
2. Generate the migration:

   ```sh
   pnpm db:generate --name add_something
   ```

3. Read `migrations/<timestamp>_add_something/migration.sql` before anything else.
4. Add by hand what Drizzle cannot emit, and say so at the top of the file:
   - `STRICT` on every table;
   - the triggers: the append-only logs, a `setup_link` redeemed once, and the rules across tables (domain.md lists
     them under Tables);
   - take out drizzle-kit's `PRAGMA foreign_keys` pair: D1 runs a migration in a transaction with foreign keys on.

   Drizzle's snapshot knows neither, so a migration that rebuilds a table drops them silently. The schema tests beside
   each feature's tables (`*-schema.test.ts`) fail when that happens. Where drizzle-kit rebuilds a table only to add a
   column with its check, `ALTER TABLE ... ADD ... CHECK` does it without a rebuild; a rule across tables is a
   trigger, which needs none.
5. Apply it locally and run the tests:

   ```sh
   pnpm db:migrate
   pnpm test
   ```

`src/shared/infrastructure/d1/migrations.test.ts` checks every migration against rows: it writes a book with the app,
puts it back into the schema as it was before each of the three newest migrations, migrates again, and compares row
for row. CI also runs `pnpm db:generate` and fails if it writes anything: a table changed without its migration.

## Removing something

A table or a column is removed one release after the code stops reading it. While a migration is applied the old
version is still running, and a rollback returns to it; both still read what was removed. A migration that cannot be
rolled back past says so in its header.

## Rules the database keeps

- `CHECK` constraints for known values, lengths and non-blank text, written from the domain's own constants through
  `src/shared/infrastructure/d1/sql-literals.ts`, so code and database cannot disagree.
- Foreign keys, and `capture` is never updated: corrections go to the note. It is deleted only with the last thing
  made from it, by trigger.
- Times are epoch-millisecond integers; ids are UUIDv7. A delete is soft (`deleted_at`) for 30 days, the trash; then,
  or when deleted for good sooner, the rows are deleted (ADR 0017, `src/features/trash/infrastructure/trash-writes.ts`).
- D1 has no interactive transactions; a batch is atomic. A use case queues its writes on a unit of work and commits
  them as one batch.
- A statement binds at most 100 parameters, so a read by a list of ids goes in chunks (`readInChunks`).

## Production

Applying migrations to the database on Cloudflare is part of a deploy, and only done when asked. See
[deployment](deployment.md).
