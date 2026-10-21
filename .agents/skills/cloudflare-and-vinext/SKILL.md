---
name: cloudflare-and-vinext
description: Running and configuring the Worker - the cf CLI rather than Wrangler, cloudflare.config.ts, bindings and secrets, the compatibility date, and the ways vinext differs from Next.js that already cost time. Use this when a cf command, a binding, a server action, a security header or the build behaves unexpectedly.
---

# Cloudflare and vinext

## cf, not Wrangler

- Configuration is `cloudflare.config.ts`. Find commands with `cf cli search "<task>"`, then `--help`; do not translate
  Wrangler commands from memory.
- `cf d1 query` has no local mode. Locally, D1 is reached through the dev server, the tests, or
  `cf d1 migrations apply --local --persist-to .cloudflare/state`.
- `cf` cannot set a single secret yet: `npx wrangler secret put <NAME> --name daybook`, without adding Wrangler to the
  project. Secret values are write-only once set.
- Keep `compatibilityDate` at the newest date the local `workerd` supports; above it the dev server refuses to start
  and `build` does not notice.
- Deploying, deleting a resource or changing a secret reaches the live app: only when asked.

## vinext

vinext implements the Next.js App Router on Vite. Next's docs apply unless vinext says otherwise.

- A server action that changes data ends with `refresh()`, or the page keeps showing the old list.
- vinext's own CSRF check compares `Origin` with `Host` and lets a request with no `Origin` through. Fetch Metadata
  checks belong in the proxy (`src/proxy.ts`, arriving with sign-in).
- A CSP nonce works the Next.js way, as the sign-in spike showed: the proxy sets `content-security-policy` on the
  request and the response, and vinext stamps the nonce on every script it emits.
- The manifest and the app icons are answered by the Worker with `max-age=0`; files in `public/` are static assets,
  free and cached.
- `next/og` (`ImageResponse`) is avoided: satori and resvg are fragile in vinext's dev server and costly on 10 ms of
  CPU.
- `prerender: { routes: "*" }` renders static routes at build; a page that reads the database exports
  `dynamic = "force-dynamic"`.

## Limits that shape code

10 ms of CPU per request on the free plan. Waiting on I/O does not count; hashing does - which is why passwords are
hashed in the browser (`docs/design.md`, "Sign-in").
