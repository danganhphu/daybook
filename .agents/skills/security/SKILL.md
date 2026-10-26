---
name: security
description: What to check before and after writing code that crosses a trust boundary here - which of Cloudflare's security-audit attack-class files to read for the area being changed, and what counts as a finding. Use this when planning or reviewing a change to sign-in, sessions, routes, headers, anything rendering user text, the AI reading, who sees or deletes which row, limits and quotas, webhooks, config and secrets, CI or dependencies.
---

# Security while coding

Cloudflare's security-audit skill is a git submodule, pinned to a reviewed commit:
`vendor/cloudflare/security-audit-skill`. Its attack-class files are the checklist; below, `<audit>` stands for
`vendor/cloudflare/security-audit-skill/skills/security-audit`. If the folder is empty, run
`git submodule update --init`.

## Read before planning, check again before calling it done

| When the change touches | Read |
| --- | --- |
| sign-in, sessions, step-up, invites, recovery, cookies, the proxy, response headers, server actions, route handlers | `<audit>/WEB-PROTOCOL-AND-AUTH.md` |
| client components, anything showing what a user typed, browser storage, redirects | `<audit>/CLIENT-SIDE.md` |
| the AI reading of notes, the bot's messages, any prompt or model output acted on | `<audit>/AI-AND-LLM.md` |
| who sees which row, search, merge, delete and restore, recently deleted, exports | `<audit>/DATA-ISOLATION-AND-LIFECYCLE.md` |
| rate limits, loops per request, anything spending a free-plan quota (requests, D1, Neurons) | `<audit>/RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` |
| the Telegram webhook, queues, cron | `<audit>/PROTOCOLS-RPC-AND-MESSAGING.md` |
| `cloudflare.config.ts`, bindings, secrets, the deploy | `<audit>/CLOUD-AND-DEPLOYMENT.md` |
| `.github/workflows`, Renovate, `pnpm-workspace.yaml`, a new dependency | `<audit>/SUPPLY-CHAIN-AND-RELEASE.md` |
| anything else that takes input from outside | `<audit>/ATTACK-CLASSES.md` |

Write the classes that apply into the plan, with how the change holds against each. Before calling the change done,
walk the diff through the same classes once more.

## What counts

- A finding names a lower-trust principal, what it sends, the control it gets past, and the result for someone else's
  data or account (`<audit>/SKILL.md`, "Core principles"). A missing best practice with no such path is hardening:
  note it, do not raise it as a vulnerability.
- Fix at the last trusted decision point, with a test that fails without the fix - as the `sign-in` skill asks.
- What the source cannot show - a Cloudflare setting, a browser's behaviour on a real phone - is a deploy-time check,
  not an assumption either way.

## Do not

- Run the skill's full audit workflow unless asked. It launches many agents, and its validators refuse to read files
  on Windows (no `O_NOFOLLOW`); they need Node on Linux.
- Probe the deployed app, or spend real quota, to settle a question. Use a local build and a throwaway state folder.
- Edit anything under `vendor/`. A newer upstream comes as a Renovate pull request that moves the pin; read its diff.
