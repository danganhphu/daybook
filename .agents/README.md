# .agents

Instructions for coding agents, in the layout the wider ecosystem is settling on: one folder per skill under
`.agents/skills`, each holding a `SKILL.md` with `name` and `description` frontmatter.

## How the two instruction sources divide

| Source | Loaded | Holds |
| --- | --- | --- |
| `AGENTS.md` | always | conventions, commands, project layout - the things that apply to every change |
| `.agents/skills/*/SKILL.md` | on demand, by `description` | procedures for one kind of task, and the traps specific to it |

A skill tells an agent **how to do something here and what goes wrong**, not the style rules. A line that belongs in
every change belongs in `AGENTS.md`.

## The skills

| Skill | Read it before |
| --- | --- |
| `sign-in` | touching `src/features/access`, or adding anything that needs a signed-in user |
| `d1-migrations` | editing a `*.table.ts` file or a migration |
| `e2e-tests` | adding a scenario, or when an end-to-end run fails |
| `design-system` | adding or restyling a component or a screen |
| `cloudflare-and-vinext` | a `cf` command, a binding, a server action or the build behaves unexpectedly |

`CLAUDE.md` forwards to `AGENTS.md`, and `.github/copilot-instructions.md` does the same, so every assistant reads one
set of rules.
