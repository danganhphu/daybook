---
name: sign-in
description: How sign-in works in this repo and what must never go wrong - where secrets live, how sessions open and end, step-up, rate limits, the access log, and the operator commands. Use this before touching src/features/access, adding a security setting, or adding anything that needs a signed-in user.
---

# Sign-in

Two people share one book. Passkeys are the way in, a password the fallback; `docs/design.md` "Sign-in" has the
reasons, `docs/domain.md` "Access" the rules. The code is the `access` slice: `src/features/access/`.

## Secrets

Every secret a browser holds - a session's secret, a setup token, a ceremony binding - is 256 random bits from the
`Secrets` port, base64url-encoded. Only its SHA-256 reaches D1.

- Make one with `newSecretToken`, store `hashSecretToken`, check with `secretTokenMatches` (constant time).
- A setup token rides in the URL fragment and reaches the server in a POST body - never a query string, which logs
  and Referer headers would keep.
- Nothing secret goes into `access_event`, a log line or an error message. A session id is the public half of a cookie
  and may.

## Sessions

- Only a use case that has **just authenticated someone** opens a session: `enlistNewSession(work, ...)` on that use
  case's own unit of work, so the sign-in commits whole or not at all. Pass `replacing` with the browser's old session.
  Never expose it on the `App`.
- A session ends 30 days after its sign-in; using it does not extend that.
- Every page and server action authenticates first. The proxy only redirects early; the check that counts is next to
  the data.

## Security settings

Anything that changes an authenticator, the username or another device, or creates an invite or recovery link, checks
`Sessions.isFresh` **in the use case** and returns `step_up_required`. The screen asking first is a courtesy, not the
control. Record the outcome in `access_event`, with `actorId` set when one user acts on the other's account.

## Rate limits

Count with the D1 `RateLimiter`, keyed by `clientNetwork(ip)`: an IPv4 address, or an IPv6 /64 - a device can hop
across its /64. Check before any expensive or revealing work, and record `rate_limited`.

## Errors

A new refusal is a code in `AccessError` with its Vietnamese sentence in `accessErrorMessages`. Refusals that would
tell a prober something - an expired link versus an unknown one - share one code.

## The operator commands

`pnpm access:account`, `access:setup-link`, `access:revoke`: the first account, and break-glass. They run the app's
use cases through `src/composition/operator-console.ts`, which records SQL instead of running it, and send it with
`cf d1 query`. That has no local mode: `--remote` or `--dry-run`, and `--remote` only when asked.

## Tests

`src/testing/support/access.ts` seeds accounts, sessions and setup links through the real code. Prove a rule by
breaking it: drop a check, watch the test meant for it fail, restore.
