# Security

What the app keeps, how it protects it, what it logs, and where it departs from OWASP ASVS 5.0 level 2 on purpose.
The sign-in rules themselves are in [domain.md](domain.md#access); the reasons in
[design.md](../product/design.md#sign-in). Reviewed against ASVS 5.0 (V3, V6, V7, V11, V14, V16) on 2026-10-26, before
the first deploy.

## Cryptography

Nothing here is secret: the keys are, not the list (Kerckhoffs). Review it when `@noble/hashes`,
`@simplewebauthn/*` or `uuid` is upgraded, and when a secret is added.

| What | Primitive and size | Where | Lives |
| --- | --- | --- | --- |
| Randomness | `crypto.getRandomValues` (workerd; Node for `pnpm access:*`) | `web-crypto-secrets.ts` | - |
| Session secret | 256 bits; SHA-256 verifier, compared in constant time | `enlist-new-session.ts`, `authenticate.ts` | 30 days, or 14 unused |
| Setup token | 256 bits, in the URL fragment; SHA-256, looked up by hash | `issue-setup-link.ts`, `redeem-setup-link.ts` | 10 minutes, once |
| Ceremony binding | 256-bit cookie; SHA-256, compared in constant time | `bound-ceremony.ts` | 5 to 10 minutes |
| WebAuthn challenge, user handle | 256 bits each | `start-passkey-sign-in.ts`, `new-account.ts` | once; the account's life |
| Password salt | 128 bits, chosen by the server | `password-keys.ts` | the password's life |
| Password key | Argon2id, t=2, m=19 MiB, p=1, 32 bytes, `@noble/hashes`, in the browser | `browser-password.ts` | the password's life |
| `PASSWORD_PEPPER` | 256-bit HMAC-SHA-256 key, versioned. Keys three things, each with its own prefix or input: the verifier, the decoy salt, the rate-limit key for a typed username | `password-keys.ts`, `pepper-keys.ts` | until rotated |
| Passkey signatures | ES256 or Ed25519, checked by `@simplewebauthn/server` on Web Crypto; no attestation | `simple-webauthn-verifier.ts` | the passkey's life |
| Breach check | SHA-1, five hex characters leave the device; fixed by the Pwned Passwords protocol | `browser-password.ts` | - |
| CSP nonce | 128 bits | `request-policy.ts` | one response |
| Ids | UUIDv7; never proof of anything alone | `*/domain/*.ts` | - |
| TLS | Cloudflare's; the app manages no certificate | - | - |

RS256 is refused: ASVS 5.0 Appendix C marks RSASSA-PKCS1-v1_5 disallowed. The Argon2id key is pinned at the real cost
to Node's own implementation (`browser-password.test.ts`), since `@noble/hashes`' audit leaves argon2 out.

**The pepper.** Made with `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"` on the owner's
machine, set as a Worker secret, never written down elsewhere. No fixed period; rotate on suspicion. If it leaks: a
new pepper, and both people set their fallback passwords again; passkeys are untouched. If it is lost: fallback
passwords stop working, passkeys do not. Rotation keeping the old pepper for old verifiers is designed, not built. The
development pepper is in this repository and the Worker refuses it anywhere but localhost.

## The browser

- **CSP**, per response with a fresh nonce (`request-policy.ts`): scripts and styles run only with the nonce, and
  `'strict-dynamic'` lets those scripts load the chunks they import; no `'unsafe-inline'`, no `'unsafe-eval'`, so no
  `style` attribute anywhere. `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`;
  `connect-src` adds only Pwned Passwords. Static files get `default-src 'none'; sandbox` from `public/_headers`.
- **Zod runs jitless in the browser** (`src/features/access/web/browser-options.ts`, the only module that parses with
  it there, on sign-in and passkey screens): its compiled parsers need `new Function`, which the CSP blocks, and the
  probe alone shows as a CSP issue.
- **Not for search engines**: every page says `noindex, nofollow`, and `robots.txt` disallows everything.
- No source maps are shipped, and nothing on the client names a secret, a binding or a table - checked in the build
  output.

## Data

| Level | What | Where | Who sees it | Leaves the system |
| --- | --- | --- | --- | --- |
| Secret - a loss is an account taken | session secrets, setup tokens, ceremony bindings, the pepper, the password | cookies, a URL fragment, a Worker secret; D1 keeps only hashes and HMACs | nobody | a setup link goes person to person; five hex characters of the password's SHA-1 go to Pwned Passwords |
| Personal or business | customers (names, phones, addresses), orders, payments, debts, notes and captures, reminders, readings, IP addresses | D1 | both users; IPs only through the D1 console | the text of a note to Workers AI, which neither keeps nor trains on it; search words in the browser's history |
| Internal | usernames, display names, passkey labels, product names, ids, device labels | D1 | both users | username and display name to the phone's password manager when a passkey is made |

Every page and server action answers `Cache-Control: private, no-store`; sign-out tells the browser to drop the
site's cookies, cache and storage. Search words travel as `?q=` so a search can be shared and reloaded; Workers Logs
drops the query.

### Retention

| Rows | Kept now | Rule |
| --- | --- | --- |
| Customers, products, orders, payments, notes, reminders, readings, captures, merges | forever; a delete hides, and is listed for 30 days | The book is the point. Captures, readings, order history and merges are append-only by trigger |
| `access_event` | forever | Meant to be kept a year: a purge comes with the scheduled job the bot brings, and needs the append-only trigger to allow rows past that age |
| `session` | until it ends and is next presented, or signed out | Swept by the same job once it exists |
| `setup_link` | spent and expired links stay | Swept by the same job |
| `ceremony` | until the next prompt starts | Swept on write |
| `rate_limit` | until the window after next | Swept on write |
| Workers Logs | 3 days (Cloudflare's free plan) | - |
| D1 Time Travel | 7 days (Cloudflare's free plan) | A restore rewinds every table, the logs included |

## Logs

| Log | Holds | Who reads it | Protected by |
| --- | --- | --- | --- |
| `access_event` | every sign-in, refusal, rate limit, lock, session end, passkey and password change, link: who, what, when (UTC), IP, device label, a small JSON detail; never a secret, token, challenge or key | each user, their 20 latest without the IP; the operator all of it | triggers refusing update and delete |
| `order_change`, `capture`, `interpretation`, `customer_merge`, `product_merge` | the book's history | both users, on their screens | the same triggers |
| Workers Logs | each request's method, URL without query, status; one JSON line per fault from `src/instrumentation.ts` (route pattern, digest, each error's name and first line); vinext's own line for a failed server action | the Cloudflare account | the Worker can write, never edit |

vinext writes a failed server action's whole error, and a failed query's error from Drizzle carries its parameters -
customer names, search words. That line is vinext's, so it stays; Workers Logs keeps it 3 days and only the Cloudflare
account can read it. Times are UTC epoch milliseconds, shown in Vietnam's time.

## Deviations

ASVS asks for these to be written down; each is a choice, not an oversight.

| ASVS | What | Why |
| --- | --- | --- |
| 6.3.3 | A password alone opens the book (single factor) | A fallback for a phone with no passkey. It never opens security settings on an account with a passkey |
| 6.2.3 | Changing the password asks for a fresh step-up, not the current password | The step-up is a passkey whenever the account has one |
| 6.1.1 | Anyone who knows a username can keep its password locked | Passkeys stay open, so it is an annoyance, not a lockout |
| 7.1.2 | No cap on sessions per account | Two people; every session is listed and can be ended |
| 7.4.4 | Sign-out is two taps from most screens | The account menu on every tab, or the foot of Settings |
| 7.3.1 (NIST 5.1) | The session cookie survives closing the app | An app that forgets its sign-in on every launch loses to the notes app on day one; 30 days, 14 idle |
| 3.5 (NIST 5.1) | No per-request CSRF token | Fetch Metadata, Origin from configuration, SameSite and `__Host-` cover a modern-browser-only app |
| 6.2 | The password policy runs in the browser | The server never sees the password, only its Argon2id key |
| 6.4 | No recovery codes | Recovery is a link from the other user, in the app |
| 16.3.2, 16.3.3 | A refused authorization or a bypass attempt writes no event | A new event kind rebuilds `access_event`; after the first deploy |
| 16.4.3 | The security log lives in the database it describes | Logpush and Tail Workers need the paid plan (ADR 0005) |
