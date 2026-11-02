# Deployment

The app is one Cloudflare Worker on the free plan, with no payment method on the account. Over a limit, Cloudflare
refuses requests instead of billing. It was first deployed on 2026-10-26, as written below.

## Before the first deploy

- Two-factor authentication on the Cloudflare account.
- A security review against OWASP ASVS 5.0 level 2 (authentication, sessions, access control, configuration,
  logging), every gap fixed or written down. Done 2026-10-26; the deliberate deviations are in
  [security](../architecture/security.md#deviations).

## Every deploy

From `main`, pulled:

```sh
pnpm run deploy
pnpm smoke https://daybook.<subdomain>.workers.dev
```

`pnpm run`, not `pnpm deploy`: pnpm has a `deploy` command of its own, which would run instead of the script. The
script first runs `scripts/release-check.ts`, which refuses anything but `main` at `origin/main` with nothing
uncommitted and prints the commit going live; then it builds for production and deploys with `cf`. Write the commit
and the Worker version `cf` prints in the deploy's notes. `pnpm smoke` then reads the live app: a page's security
headers, the service worker's, and the bot's webhook refusing a request without its secret (401 with the bot on, 404
with it off).

A release that adds migrations applies them first, with the two commands of the first deploy's step 1; `cf` asks
before it applies, in a terminal of your own. Before that:

1. **Export the database** to a file on your own disk ([backups](#backups)): Time Travel keeps 7 days, a file keeps
   for good, and the same file lets the migration be tried on real rows first, locally.
2. **Note the bookmark** `cf` prints before applying: it is where a restore goes back to.
3. **A migration never removes what the running version reads.** A table or a column goes one release after the code
   stopped using it; a migration whose header says it breaks rollback is applied only with a plan for it.

## The first deploy

1. **Migrations** on the remote database (without `--local`, `cf` targets Cloudflare), then check nothing is left:

   ```sh
   pnpm exec cf d1 migrations apply <database id> --dir migrations --pattern "migrations/*/migration.sql"
   pnpm exec cf d1 migrations list <database id> --dir migrations --pattern "migrations/*/migration.sql"
   ```

2. **The Worker and its two secrets, together.** `cf` refuses to deploy while `APP_ORIGIN` and `PASSWORD_PEPPER`
   are not set, and a Worker that does not exist yet cannot be given secrets beforehand. So the first deploy carries
   them in a file that is removed at once, with the pepper generated straight into it and never shown.
   `<subdomain>` is the account's `workers.dev` subdomain, on the dashboard's Workers & Pages page.

   ```sh
   pnpm run build
   secrets=$(mktemp)
   printf 'APP_ORIGIN=https://daybook.<subdomain>.workers.dev\nPASSWORD_PEPPER=%s\n' \
     "$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")" > "$secrets"
   pnpm exec cf deploy --prebuilt --secrets-file "$secrets"; rm -f "$secrets"
   ```

   In PowerShell:

   ```powershell
   pnpm run build
   $secrets = New-TemporaryFile
   try {
     $pepper = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
     Set-Content -LiteralPath $secrets -Value "APP_ORIGIN=https://daybook.<subdomain>.workers.dev`nPASSWORD_PEPPER=$pepper"
     pnpm exec cf deploy --prebuilt --secrets-file $secrets
   } finally { Remove-Item -LiteralPath $secrets -Force }
   ```

   `daybook.<subdomain>.workers.dev` is the passkeys' RP ID: renaming the Worker or the subdomain orphans every
   passkey. The pepper is written down nowhere; losing it stops fallback passwords only
   ([security](../architecture/security.md#cryptography)).

3. **The first account**, from the command line against the live database, then everything else from the app. Run it
   in a terminal of your own: the setup link it prints is a secret, valid once for ten minutes, so have the phone ready.

   ```sh
   pnpm access:account --username <name> --name "<display name>" --origin https://daybook.<subdomain>.workers.dev --remote
   ```

4. **Check on real phones:** set up a passkey, sign in from the installed app, sign out, invite the second person.

## The deploy that brings notifications

Once, before the first `pnpm run deploy` with notifications in it:

1. **Migrations** on the remote database, as above. This one rebuilds `access_event` with its rows (checked on seeded
   rows beforehand: every event kept, both append-only triggers back).
2. **The two queues**, the jobs and where a job that keeps failing waits:

   ```sh
   pnpm exec cf queues create --queue-name jobs
   pnpm exec cf queues create --queue-name jobs-dead
   ```

3. **The Web Push key pair**, as two secrets, before the deploy: `cf` refuses a deploy while a secret the config names
   is unset. Generated straight into the pipe, never shown:

   ```powershell
   $keys = pnpm -s notifications:keys | ConvertFrom-Json
   $keys.VAPID_PUBLIC_KEY | npx wrangler secret put VAPID_PUBLIC_KEY --name daybook
   $keys.VAPID_PRIVATE_KEY | npx wrangler secret put VAPID_PRIVATE_KEY --name daybook
   ```

   Keep the pair for good. A new one stops every browser's subscription, which was made with the old public key; each
   person then turns notifications on again.
4. `pnpm run deploy`. A cron trigger takes up to 15 minutes to reach Cloudflare's network.

## The deploy that brings the trash

Two migrations, applied as above before `pnpm run deploy`:

- `per_use_quiet_days` rebuilds `notification_preference` with its rows, each person getting 21 days, and drops
  `book_setting`: a number set there before is not carried over, since the days are now each use's own.
- `trash_for_customers_products_kinds` adds the delete columns to `customer`, `product`, `customer_kind` and
  `deleted_with` to `sales_order` and `reminder`, without rebuilding them, and replaces the triggers that refused any
  delete of a log, a payment, a merge record, a capture or an interpretation (ADR 0017). From this deploy, deleting for
  good removes rows; D1's Time Travel can still bring the whole database back to a moment within the last 7 days on
  the free plan (https://developers.cloudflare.com/d1/reference/time-travel/).

Note the bookmark `cf` prints before applying, as for every migration. After the deploy the first cron run of a day
in Vietnam empties the trash of what is older than 30 days.

## The deploy that brings the Telegram bot

The bot is optional (ADR 0014): deployed without its two secrets, it is off, `/telegram/webhook` answers 404 and
Settings offers no Telegram. Once, to turn it on:

1. **Migrations** on the remote database, as above: `telegram_bot` (the link tables, a capture's `source_ref`, the
   "Gửi qua Telegram" switch, added without rebuilding the tables that have rows), `audit_fixes` (a line's kept total,
   two indexes, the new triggers) and `reply_failed_in_inbox`, which rebuilds `inbox_item` and
   `notification_delivery` with their rows; nothing points at either.
2. **A bot from BotFather** (`/newbot`), whose token is the first secret. The second is the webhook's, 32 random
   bytes. Both go up with the deploy, in one version, from a file removed at once: set one at a time, a version would
   run with half the pair, which turns the bot off until the other arrives. In PowerShell, with `$token` holding the
   token as BotFather showed it:

   ```powershell
   node scripts/release-check.ts
   pnpm run build
   $secrets = New-TemporaryFile
   try {
     $webhook = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
     Set-Content -LiteralPath $secrets -Value "TELEGRAM_BOT_TOKEN=$token`nTELEGRAM_WEBHOOK_SECRET=$webhook"
     pnpm exec cf deploy --prebuilt --secrets-file $secrets
   } finally { Remove-Item -LiteralPath $secrets -Force }
   ```

   The two are not declared in `cloudflare.config.ts`, so a later `pnpm run deploy` keeps them (cf keeps the Worker's
   secrets the config does not name) and never refuses to deploy without them.
3. **Tell Telegram where the webhook is**, in a shell holding the same two values, never echoed:
   `pnpm telegram:setup --origin https://daybook.<subdomain>.workers.dev`. It also sets the commands and the bot's
   descriptions. Run it again whenever the origin or the commands change.
4. `pnpm smoke` answers 401 for the webhook. Each person links their Telegram in Settings > Telegram, on their phone.

The deploy also starts the consumer of `jobs-dead` (`cloudflare.config.ts`): from then on a job that failed every
retry leaves a `job_dead` line in Workers Logs, and a bot reply that never went out shows in its sender's bell.

## Rolling back

A deploy that went wrong goes back to the version before it; the database goes back only when a migration broke it.

1. **The Worker.** Find the version that ran before: `pnpm exec cf workers versions list --worker-id daybook`. Deploy
   it again, all traffic on it, from a file holding
   `[{"version_id":"<the version's id>","percentage":100}]`:

   ```sh
   pnpm exec cf workers deployments create --worker daybook --strategy percentage --versions @versions.json
   ```

   Preview it with `--dry-run` first. Only the 100 latest versions can come back, and Cloudflare refuses to go back
   past a change of secrets unless told to (`--bypass-deployment-checks`): read its message before forcing it. Code
   from before a migration may not read the rows after it, which is why removals wait a release.
2. **The database**, only if a migration damaged rows: `pnpm exec cf d1 time-travel restore <database id> --bookmark
   <the bookmark noted before migrating>`. It rewinds every table, so everything written since is lost, the access log
   too; the export taken before the migration holds what to put back by hand. Then apply the migrations again, fixed,
   as above.
3. Run `pnpm smoke`, and write down what happened.

## Backups

Time Travel keeps 7 days on the free plan, and since the trash deletes for real (ADR 0017), a mistake noticed later
is gone. So an export, kept on your own disk: before every remote migration, and once a week. `cf` has no export yet,
so Wrangler does it through `npx` without joining the project:

```sh
npx wrangler d1 export daybook --remote --output daybook-<date>.sql
```

An export blocks the database's other requests while it runs; for a book this size that is seconds. The file holds
every customer, order and note: keep it off cloud folders that sync to other people. To try a migration on it, load it
into a scratch local database (`npx wrangler d1 execute <name> --local --file daybook-<date>.sql`), never the dev one.

## Changing a secret

The Worker exists now, so Wrangler sets one secret and deploys a new version at once. Pipe the value in, so it never
shows and stays out of the shell's history (`cf workers secrets update` takes it as a flag, which history keeps):

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put PASSWORD_PEPPER --name daybook
```

A new pepper stops every fallback password until it is set again; passkeys keep working.

A secret that comes in a pair - the Web Push keys, the bot's token and webhook secret - is changed with the next
deploy instead, both in one `--secrets-file`, as the bot's first deploy does: one at a time, a version runs with half
the pair, and that part of the app is off until the other arrives (`push_misconfigured` or `telegram_misconfigured` in
Workers Logs). A new bot token or webhook secret also needs `pnpm telegram:setup` again.

## Checks after a deploy

- The headers of a page and of static files (`/_next/static/...`, `/manifest.webmanifest`), read with `curl -sI`:
  HSTS, `nosniff`, `Referrer-Policy` and a CSP on each. Done on 2026-10-26: all there, static files from
  `public/_headers`, compressed with Brotli.
- The sign-in page's prompt request (`POST /sign-in`) answers 200: the database and both secrets work.
- The first `access_event` rows carry an IP (`CF-Connecting-IP` reached the Worker).
- Workers Logs is on, and a request with a query shows without it.
- Back after signing out, on both phones, shows the sign-in page, not the book.
- The hostname serves nothing else, and there are no preview URLs (`previewUrls: false`).
- `/sw.js` answers with `Content-Security-Policy: default-src 'self'` and `Cache-Control: no-cache`, not the sandbox
  the other static files get.
- Notifications on a real phone: turn them on in Settings > Thông báo, set the morning time to the next quarter hour
  with something due, and wait. Workers Logs then shows `notifications_queued`, and each `scheduled` and `queue`
  invocation's `cpuTime` - the number ADR 0015 waits for: a cron run on a fresh isolate loads vinext too.
- The Worker runs beside the database: a page's response carries `cf-placement` naming a data center near Osaka, and
  in Workers Logs a screen's `wallTimeMs` is tens of milliseconds, not hundreds (see
  [configuration](configuration.md#runtime)). The header may go away once placement leaves beta.

## Limits that matter

| Limit | Consequence |
| --- | --- |
| 10 ms CPU per request | Password hashing runs in the browser for this reason. Measured 2026-10-27, after the work in [configuration](configuration.md#runtime): a screen change about 22 ms, a first open about 65 ms, so most requests are over; none has been refused, but "consistently" over is when Cloudflare starts to (error 1102). Watch for it: the dashboard shows "Exceeded CPU Time Limits", and Workers Logs an outcome of `exceededCpu` instead of `ok`. If it appears, Workers Paid ($5 a month, 30 s per request) needs no code change |
| 100,000 requests a day | Static assets do not count |
| D1: 5M rows read, 100k rows written a day | Every lookup is indexed |
| Cron: 10 ms CPU a run | The scheduler only reads and queues; it sends nothing itself. Whether a fresh isolate's start counts toward it is not documented: read `cpuTime` for `scheduled` in Workers Logs |
| Queues: 10,000 operations a day, 24 hours' retention | About 20 a day here, a few more with the bot. A job that fails three times goes to `jobs-dead`, whose consumer logs it (`job_dead`) and tells the sender of an unanswered bot message in the bell |
