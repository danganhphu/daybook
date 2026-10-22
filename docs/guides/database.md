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
   - the triggers that make `capture` and `access_event` append-only, and the one that lets a `setup_link` be
     redeemed once.

   Drizzle's snapshot knows neither, so a migration that rebuilds a table drops them silently.
   `src/shared/infrastructure/d1/schema.test.ts` and `src/features/access/infrastructure/access-schema.test.ts` fail
   when that happens.
5. Apply it locally and run the tests:

   ```sh
   pnpm db:migrate
   pnpm test
   ```

## Rules the database keeps

- `CHECK` constraints for known values, lengths and non-blank text, written from the domain's own constants through
  `src/shared/infrastructure/d1/sql-literals.ts`, so code and database cannot disagree.
- Foreign keys, and `capture` is never updated or deleted: corrections go to the note.
- Times are epoch-millisecond integers; ids are UUIDv7; deletes are soft (`deleted_at`).
- D1 has no interactive transactions; a batch is atomic. A use case queues its writes on a unit of work and commits
  them as one batch.

## Production

Applying migrations to the database on Cloudflare is part of a deploy, and only done when asked. See
[deployment](deployment.md).
