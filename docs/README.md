# Documentation

## Getting started

- [Installation](getting-started/installation.md) - what you need, installing, the local database, the first account
- [Development](getting-started/development.md) - the dev server, the production build locally, checks before a change

## Guides

- [Configuration](guides/configuration.md) - bindings, secrets, runtime settings, environment variables
- [Commands](guides/commands.md) - every script, and the account commands
- [Testing](guides/testing.md) - unit and use-case tests, end-to-end tests, CI
- [Database](guides/database.md) - changing the schema, the rules the database keeps
- [Deployment](guides/deployment.md) - the plan for the first deploy
- [Troubleshooting](guides/troubleshooting.md) - problems already met, and their fixes

## Product and design

- [Product design](product/design.md) - what the product does and why, decision by decision
- [Design system](ui/design-system.md) - principles, tokens, components, how styles are written
- [Screenshots](ui/screenshots.md) - every screen on an Android phone, and one on a desktop

## Architecture

- [Overview](architecture/overview.md) - one Worker, feature slices, the path of a request
- [Domain](architecture/domain.md) - the data model, its vocabulary and its rules
- [Security](architecture/security.md) - the cryptography, the data and how long it is kept, the logs, and the
  deliberate departures from OWASP ASVS

## Elsewhere

- [AGENTS.md](../AGENTS.md) - conventions for people and coding agents alike: layout, errors, tests, style
- [SECURITY.md](../SECURITY.md) - reporting a vulnerability
- `.agents/skills/` - step-by-step procedures for the parts that are easy to get wrong (sign-in, migrations,
  end-to-end tests, the design system, Cloudflare and vinext, security while coding)
