---
name: design-system
description: Building UI in this repo - tokens through Sass functions, CSS Modules beside each component, Base UI for behaviour, the /dev/ui gallery, mobile first, colour contrast and the app icon. Use this before adding or restyling a component or a screen.
---

# The design system

The rules and the numbers are in `docs/ui.md`. This is how to work with them.

## A component

- `src/shared/ui/<name>/`: `<name>.tsx` and `<name>.module.scss`. Behaviour from Base UI, appearance from our SCSS.
- Every module starts `@use "abstracts" as *;` and takes values only through `color()`, `space()`, `radius()`,
  `size()`, `z()`, `duration()`, `easing()` and `@include text(...)`. An unknown token fails the build; a raw value
  fails Stylelint.
- Components take no `className` or `style`. A screen arranges components; it does not restyle them.
- Anything animated sits in `@include motion`, so reduced motion turns it off.
- Put every state of a new component on `/dev/ui` (`src/app/dev/ui/`), which 404s in production.
- After changing class names, run `pnpm build` or `pnpm dev` once: the typed `*.module.scss.d.ts` files are written
  by the build and committed. CI fails if they drift.

## Look

- Mobile first: write for the phone, add `@include from(md)` (640px) or `from(lg)` (1024px) for wider screens.
  Review the phone screenshot first.
- One accent colour, neutral greys, flat cards, Material 3 corners. No gradients, glass, glow or per-section colours.
- A new colour pair is checked for WCAG AA (4.5:1 text, 3:1 boundaries) before it lands. The accent `#0672e2` passes
  on white at 4.65:1 but not on the canvas, where links use `accent-hover`.

## Copy

Vietnamese, with full diacritics, short. Errors say what to do next.

## The app icon

`scripts/generate-icons.ts` is its only source. Change it, run `pnpm icons`, commit what it writes.
