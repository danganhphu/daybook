# Deployment

The app is one Cloudflare Worker on the free plan, with no payment method on the account. Over a limit, Cloudflare
refuses requests instead of billing. It was first deployed on 2026-10-26, as written below.

## Before the first deploy

- Two-factor authentication on the Cloudflare account.
- A security review against OWASP ASVS 5.0 level 2 (authentication, sessions, access control, configuration,
  logging), every gap fixed or written down. Done 2026-10-26; the deliberate deviations are in
  [security](../architecture/security.md#deviations).

## Every deploy

From `main`, clean and pulled:

```sh
pnpm run deploy
```

`pnpm run`, not `pnpm deploy`: pnpm has a `deploy` command of its own, which would run instead of the script. The
script builds for production and deploys with `cf`.

A release that adds migrations applies them first, with the two commands of the first deploy's step 1; `cf` asks
before it applies, in a terminal of your own.

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

## Changing a secret

The Worker exists now, so Wrangler sets one secret and deploys a new version at once. Pipe the value in, so it never
shows and stays out of the shell's history (`cf workers secrets update` takes it as a flag, which history keeps):

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put PASSWORD_PEPPER --name daybook
```

A new pepper stops every fallback password until it is set again; passkeys keep working.

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
| Queues: 10,000 operations a day, 24 hours' retention | About 20 a day here. A job that fails three times waits a day in `jobs-dead`, then is gone; nothing alerts on it |
