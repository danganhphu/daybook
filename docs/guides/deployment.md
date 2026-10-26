# Deployment

**Not deployed yet.** The first deploy is its own step, after a security review; this page is the plan, and becomes
the procedure once it has been followed for real.

The app is one Cloudflare Worker on the free plan, with no payment method on the account. Over a limit, Cloudflare
refuses requests instead of billing.

## Before the first deploy

- Two-factor authentication on the Cloudflare account.
- A security review against OWASP ASVS 5.0 level 2 (authentication, sessions, access control, configuration,
  logging), every gap fixed or written down. Done 2026-10-26; the deliberate deviations are in
  [security](../architecture/security.md#deviations).

## Steps

1. **Secrets.** `cf` cannot set a single secret yet, so Wrangler runs through `npx`:

   ```sh
   npx wrangler secret put APP_ORIGIN --name daybook        # e.g. https://daybook.<subdomain>.workers.dev
   npx wrangler secret put PASSWORD_PEPPER --name daybook   # 32 random bytes, base64url
   ```

2. **Migrations** on the remote database (without `--local`, `cf` targets Cloudflare):

   ```sh
   pnpm exec cf d1 migrations apply <database id> --dir migrations --pattern "migrations/*/migration.sql"
   ```

3. **Deploy:** `pnpm deploy`.
4. **The first account**, from the command line against the live database, then everything else from the app:

   ```sh
   pnpm access:account --username <name> --name "<display name>" --origin <APP_ORIGIN> --remote
   ```

5. **Check on real phones:** set up a passkey, sign in from the installed app, sign out, invite the second person.
6. **Check what only the deployed app shows:**
   - the headers of a page, a static file (`/_next/static/...`) and `/manifest.webmanifest`, read with
     `curl -sI`: HSTS, `nosniff`, `Referrer-Policy` and a CSP on each;
   - the first `access_event` rows carry an IP (`CF-Connecting-IP` reached the Worker);
   - Workers Logs is on, and a request with a query shows without it;
   - Back after signing out, on both phones, shows the sign-in page, not the book;
   - the hostname serves nothing else.

## Limits that matter

| Limit | Consequence |
| --- | --- |
| 10 ms CPU per request | Password hashing runs in the browser for this reason; measure server rendering after the deploy |
| 100,000 requests a day | Static assets do not count |
| D1: 5M rows read, 100k rows written a day | Every lookup is indexed |
