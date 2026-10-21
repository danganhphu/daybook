<!--
The title must be a Conventional Commit, lower case, no trailing period:
  feat(notes): restore a deleted note from the menu
A workflow checks it.
-->

## What changed

<!-- One or two sentences. What the reader would otherwise have to reconstruct from the diff. -->

## Why

<!-- The problem, not the solution. -->

## Checklist

- [ ] `pnpm format:check`, `lint`, `typecheck`, `test` and `build` pass; `test:e2e` too when a screen changed
- [ ] A load-bearing test was shown to fail before it passed
- [ ] A change to the data model is described in `docs/domain.md`
- [ ] No secret, token or real person's details in the code, the tests, the docs or this description
- [ ] ASCII punctuation in code, comments and the commit message; Vietnamese copy with full diacritics
