# UI guidelines

daybook should look like a product from a team with a real design system - calm, quiet, obviously deliberate - and
never like a generated app. Numbers below come from Microsoft Fluent 2, AWS Cloudscape and Apple's Human Interface
Guidelines; where they disagree, the choice and the reason are stated.

## Principles

**Design for what she needs right now.** Every screen has one main job and puts it first. On the phone that is one
vertical flow; nothing is shrunk to fit.

**Reflow, don't resize.** A desktop layout is rearranged for the phone, not scaled down. Change the representation
when the space changes: a desktop table becomes a list of rows, a long legend becomes inline labels.

**Disclose progressively.** Summary first, detail on tap. A row shows the one or two values that matter; the rest
waits behind it.

**Color carries meaning, nothing else.** Surfaces are neutral. The accent marks the primary action, links and focus.
Red means danger. That is the whole palette. No gradients, no tinted overlays, no glass, no glow, no color per
section or per category - categories are told apart by words and position.

**Motion only when it explains something.** An overlay entering, a toast appearing, an error pointing at a field.
Never decoration, never on frequent interactions, and none at all under reduced motion.

**Never lose her words, and never make her confirm the obvious.** Save first, fix later. Common destructive actions
are one tap plus an Undo in the result toast; a confirmation dialog is only for something irreversible.

## Interaction rules

- **Validation:** nothing is validated on the first visit. Validate on blur once something was entered, and on
  submit; show a hint, not an error, while she is still typing. Errors sit under the field. On submit, focus the
  first error.
- **Destructive actions** are grouped apart from ordinary ones (a divider, danger color) and never take the filled
  primary style.
- **Disabled controls** say why in one sentence and what unlocks them. If nothing can unlock it, hide it instead.
  A submit button is never disabled.
- **Same names get a context line:** two clinics called "Lan" each show the district or last order beneath.
- **Active filters stay visible** as removable chips next to the results.
- **Numbers:** amounts and quantities are right-aligned with tabular figures, formatted the Vietnamese way
  (`8.450.000đ`).
- **Empty states:** a heading that says what is empty, one line on why only if it helps, and the action that fills
  it.
- **Response time:** under a second shows nothing; longer shows progress in place, not a full-screen spinner.

## Tokens

Defined in `src/shared/ui/styles/abstracts/_tokens.scss` (names) and `src/shared/ui/styles/themes/_light.scss`
(color values). Components use them through functions - `color(text-muted)`, `space(4)`, `radius(control)` - and an
unknown name fails the build.

### Color roles

| Role | Value | Used for | Contrast |
|---|---|---|---|
| `canvas` | `#f4f7fa` | Page background | |
| `surface` | `#ffffff` | Cards, sheets, inputs | |
| `surface-subtle` | `#eef2f6` | Hover and pressed states, disabled controls | |
| `border` | `#e1e5ea` | Separators and surface edges that carry no meaning | decorative |
| `border-strong` | `#7f8790` | Input outlines and other control boundaries | 3.24:1 or more |
| `text` | `#141b24` | Body text | 15.41:1 or more |
| `text-muted` | `#565e69` | Secondary text, timestamps | 5.82:1 or more |
| `accent` | `#2063b0` | Primary action, links, focus ring | 5.63:1 on canvas |
| `accent-hover` | `#07519d` | Hover and pressed accent | |
| `on-accent` | `#ffffff` | Text on accent | 6.05:1 |
| `danger` | `#c51e21` | Destructive actions, errors | 5.21:1 or more |

Text pairs meet WCAG AA 4.5:1 and control boundaries 3:1, checked on every background each role is used on. The
values are oklch in the source; the hex is for reading. Change a value, re-check the ratios. A new role is added
only when something needs a meaning the list does not have.

There is no dark theme yet. Because components only ask for roles, a dark theme is one more file in
`src/shared/ui/styles/themes/`.

### Type

Inter with the Vietnamese subset (Geist, a common default, has no Vietnamese glyphs). Two weights: 400 and 600.

| Style | Size / line height | Use |
|---|---|---|
| `caption` | 12 / 16 | The smallest anything gets |
| `body-sm` | 14 / 20 | Secondary lines |
| `body` | 16 / 24 | Default. 16px also stops iOS zooming into inputs |
| `label` | 16 / 24, 600 | Field labels, row titles |
| `title` | 20 / 28, 600 | Screen titles |
| `display` | 28 / 36, 600 | The one key number on a summary |

Fluent's web body is 14px and HIG's is 17pt; 16px sits between and is the right size for a phone-first form.

### Space, size, shape

- **Spacing** is a 4px grid: steps 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4px to 64px). Page gutter `space(4)`.
- **Touch targets** are at least 44px (HIG, Fluent); primary actions and list rows 48px; at least 8px between
  neighbours.
- **Radius:** 8px on controls, 12px on cards and sheets. Nothing is a pill except chips.
- **Elevation:** surfaces at rest are flat with a 1px border. A shadow only marks something that overlaps - popover,
  sheet, dialog, toast (Cloudscape's rule).
- **Content width** stops at 640px; text never runs wider than about 60 characters.
- **Overlays:** menus are at least 200px wide; toasts take the full width on a phone and 360px from `md`.
- **Breakpoints:** mobile first; `md` from 640px, `lg` from 1024px.

### Motion

`fast` 120ms for overlays, toasts and inline errors; `slow` 240ms is the ceiling. Easing `out` is
`cubic-bezier(0, 0, 0, 1)`, Cloudscape's responsive curve. Everything animated sits inside `@include motion`, so
reduced motion turns it off.

## Components

In `src/shared/ui/<name>/`, one component per file with its styles beside it. They take no `className` or `style`:
a screen arranges components, it does not restyle them. Every component, in every state, is on `/dev/ui` while the
dev server runs; production answers 404 there. A new component goes on that page in the same change.

| Component | For | Rules it holds |
|---|---|---|
| `Button` | An action with a text label | `variant` primary, secondary (default) or quiet. `tone="danger"` exists only on secondary and quiet, so the type refuses a filled red button. `size` md is 44px, lg 48px for the main action and list rows |
| `IconButton` | An action shown as an icon alone | Square; quiet unless it is the one action the screen exists for, such as send, which takes `variant="primary"` (never with the danger tone). `label` is required: it is the accessible name, the only one there is |
| `TextArea` | Free text | Opens at one line and grows with the text up to 8, then scrolls (`field-sizing: content`; older browsers keep 3 rows). Invalid through `aria-invalid`, the message in a paragraph below, linked with `aria-describedby` |
| `ActionMenu` | The ... menu on a row | Takes `actions` and an optional `destructive`. The destructive item is always last, below a divider, in the danger color |
| `Toaster`, `useToast()` | The result of an action, with Undo when it can be undone | Mounted once in `src/app/layout.tsx`. A plain toast closes after 7 seconds (Fluent); one with an action after 10, and using the action closes it. Phone: full width at the bottom, the action under the title. From `md`: bottom right. A bar docked at the bottom calls `useToastClearance` so toasts sit above it, never on it |
| `EmptyState` | A list with nothing in it | `title` says what is empty, `description` only when it helps, `action` is what fills it |

- **A disabled control says why.** Pass `focusableWhenDisabled` so keyboard and screen-reader users reach it, and
  point `aria-describedby` at the sentence beneath it.
- **Keyboard:** menus open with Enter and move with the arrow keys; Escape closes and returns focus to the trigger.
  F6 moves into the toast region, Tab reaches the toast and its action. Checked on `/dev/ui`.
- **Base UI hides a toast's close button from screen readers** (`aria-hidden`) until the toast is focused or
  expanded. That is its design, not a bug of ours.

## How styles are written

- **Behavior comes from Base UI**, appearance from our SCSS. Base UI exposes state as data attributes, so styles
  read `&[data-open]`, `&[data-disabled]`.
- **Every component's styles live next to it** as `name.module.scss`. Screens compose components from
  `src/shared/ui`; a screen never invents its own button or color.
- **Sass modules only:** `@use` and `@forward`, never `@import`. Each module starts with `@use "abstracts" as *;`.
- **Class names are kebab-case** in SCSS and arrive camelCase in TypeScript (`.page-title` -> `styles.pageTitle`).
  The dev server and build write a typed `.module.scss.d.ts` beside each module; those files are committed, and a
  misspelled class is a type error.
- **Global CSS is tiny** and lives in cascade layers (`reset`, `base`). Module styles are unlayered, so they win
  without specificity tricks.
- **Stylelint enforces the rest:** no raw colors, spacing, radius, type or z-index values outside the token files,
  no hex or named colors, no `!important`, no ids, nesting at most 3 deep.
- **Prefer native CSS** where it exists: custom properties, logical properties (`margin-inline`, `block-size`),
  `:has()`, container queries. Sass is for what CSS cannot do at build time - token maps, guarded functions, mixins.

## Sources

- Fluent 2 typography, layout, color, elevation, shapes, motion, toast: https://fluent2.microsoft.design
- Cloudscape typography, spacing, colors, visual style, motion, delete pattern, validation, disabled states, empty
  states: https://cloudscape.design
- Apple HIG typography, accessibility, buttons, alerts, motion, lists: https://developer.apple.com/design/human-interface-guidelines
- Base UI button, menu, toast, field, composition, styling: https://base-ui.com/react (pages end in `.md` for plain text)
- `field-sizing`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing
