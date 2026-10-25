# UI guidelines

daybook should look like a product from a team with a real design system - calm, quiet, obviously deliberate - and
never like a generated app. It is a phone app first, so it should feel like one, not like office software: large
type, generous corners, a light grey page, one bright green, coloured icons. Numbers come from Apple's Human Interface
Guidelines, Material 3 and WCAG; interaction rules from Microsoft Fluent 2 and AWS Cloudscape. Where they disagree,
the choice and the reason are stated.

## Principles

**Design for what the user needs right now.** Every screen has one main job and puts it first. On the phone that is one
vertical flow; nothing is shrunk to fit.

**Reflow, don't resize.** A desktop layout is rearranged for the phone, not scaled down. Change the representation
when the space changes: a desktop table becomes a list of rows, a long legend becomes inline labels.

**Disclose progressively.** Summary first, detail on tap. A row shows the one or two values that matter; the rest
waits behind it.

**Color carries meaning.** Surfaces are neutral. The green accent marks the primary action, the current tab, links
and focus; red means danger. An icon takes the tone of what it is about - money green, people blue, debt orange - the
same on every screen (see Icon tones), and a word or a shape always says it too, so colour is never the only cue. Two
touches go beyond flat colour: the wash, a faint green at the top of a tab's own screen fading into the grey, and the
tab bar, frosted, floating over the foot of the page. No glow, no shadows on cards.

**Motion only when it explains something.** An overlay entering, a toast appearing, an error pointing at a field.
Never decoration, never on frequent interactions, and none at all under reduced motion.

**Never lose the user's words, and never make them confirm the obvious.** Save first, fix later. Common destructive
actions
are one tap plus an Undo in the result toast; a confirmation dialog is only for something irreversible.

## Interaction rules

- **Validation:** nothing is validated on the first visit. Validate on blur once something was entered, and on
  submit; show a hint, not an error, while still typing. Errors sit under the field. On submit, focus the
  first error.
- **Destructive actions** are grouped apart from ordinary ones (a divider, danger color) and never take the filled
  primary style.
- **Disabled controls** say why in one sentence and what unlocks them. If nothing can unlock it, hide it instead.
  A submit button is never disabled.
- **Same names get a context line:** two customers called "Lan" each show the district or last order beneath.
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
| `canvas` | `#f1f1f1` | Page background: a neutral grey, so white cards stand out without borders | |
| `surface` | `#ffffff` | Cards, sheets, inputs | decorative on canvas |
| `surface-float` | `#ffffff` at 88% | The tab bar, which the page shows through blurred | over black text, even unblurred: muted 4.88:1, accent text 4.73:1 |
| `surface-subtle` | `#e3e3e3` | Hover and pressed states, disabled controls, the track behind filter chips | text 15.88:1, muted 4.98:1, accent text 4.82:1, danger 4.75:1 on it |
| `control-fill` | `#f6f6f6` | A secondary button, a round icon tile: a step off white and off the canvas | text 18.86:1, danger 5.65:1 on it |
| `border` | `#e6e6e6` | Separators that carry no meaning | decorative |
| `border-strong` | `#8a8a8a` | Input outlines and other control boundaries | 3.06:1 or more |
| `text` | `#050505` | Body text | 15.88:1 or more |
| `text-muted` | `#5f5f5f` | Secondary text, timestamps, tabs not shown | 4.98:1 or more |
| `accent` | `#00a915` | The fill under white: the primary button, the send button | white on it 3.14:1, large bold text only |
| `accent-hover` | `#009512` | The primary button hovered or pressed | white on it 3.96:1 |
| `accent-text` | `#007129` | Green words on a light background: links, the current tab, an action row; the focus ring | 4.82:1 or more |
| `accent-wash` | `#f3fdf2` | The top of a tab's own screen, fading into the canvas | text 19.55:1, muted 6.12:1, accent text 5.93:1 |
| `on-accent` | `#ffffff` | Text on the accent | 3.14:1 |
| `danger` | `#c2181d` | Destructive actions, errors | 4.75:1 or more |
| `scrim` | `text` at 40% | Dims the page behind a dialog | not read on |
| `icon-*` | see Icon tones | An icon's colour by what it is about | 3:1 or more on white |

**Two greens.** A bright green fill under white text cannot reach 4.5:1: at that ratio the button is a dark forest
green. So the fill and green words are separate roles. `accent` is as bright as white text allows at 3:1, and every
label on it is large text in WCAG's sense: `label-strong`, 19px bold (14pt bold is the threshold). `accent-text` is
the green for words on white, the canvas or a hover grey. A filled button's edge is 2.78:1 against the canvas, which
WCAG 1.4.11 allows because its label already says what it is; the focus ring, which has no label, uses `accent-text`.

### Icon tones

A screen asks for a meaning - `iconTones.money` from `src/shared/ui/icon/icon-tone.ts` - never for a colour, so one
meaning has one colour everywhere. A tone colours an icon, a graphic held to 3:1 (WCAG 1.4.11); it is never used for
text.

| Meaning | Tone | Value | On white |
|---|---|---|---|
| Money that came in or will: a total, revenue, a payment | `icon-green` | `#00a915` | 3.14:1 |
| People: a customer, a call | `icon-blue` | `#1177e7` | 4.36:1 |
| What is still owed | `icon-orange` | `#e56900` | 3.31:1 |
| Removing, deleting | `icon-red` | `#db2c2b` | 4.76:1 |
| Getting goods to the customer | `icon-purple` | `#864ad2` | 5.34:1 |
| Words written down: a note, an address, the history | `icon-amber` | `#c57800` | 3.46:1 |
| Things the book lists: a product, a kind | `text-muted` | `#5f5f5f` | 6.39:1 |

Text pairs meet WCAG AA - 4.5:1, or 3:1 for large text - and control boundaries 3:1, checked on every background each
role is used on, hover and press included. The
values are oklch in the source; the hex is for reading. Change a value, re-check the ratios (the script that
computed these is kept with the project notes). A new role is added only when something needs a meaning the list
does not have.

There is no dark theme yet. Because components only ask for roles, a dark theme is one more file in
`src/shared/ui/styles/themes/`.

### Type

Inter with the Vietnamese subset (Geist, a common default, has no Vietnamese glyphs). Weights 400 and 600, and 700
for a filled button's label only.

| Style | Size / line height | Use |
|---|---|---|
| `caption` | 13 / 18 | The smallest anything gets: tab labels, small print |
| `caption-strong` | 13 / 18, 600 | The current tab's label |
| `body-sm` | 15 / 20 | Secondary lines, a row's second line |
| `body` | 17 / 24 | Default. Above 16px, so iOS never zooms into an input |
| `label` | 17 / 24, 600 | Field labels, row titles, buttons |
| `label-strong` | 19 / 24, 700 | A filled button's label: large text, so white on the bright green is enough |
| `title` | 22 / 28, 600 | A page's title within a tab |
| `display` | 30 / 38, 600 | A tab's own screen title |
| `hero` | 36 / 44, 600 | A screen's one big number, in `icon-green` |

17px is Apple's body size; the first version's 16px read as a form, not a phone app.

### Icons

Material Symbols Rounded (Google, Apache-2.0), weight 400 on its 24-unit grid. Outlined by default; filled for the
current tab and the icon leading a row, as Material marks what is chosen. `scripts/generate-symbols.ts`
lists the icons the app uses, and `pnpm symbols` writes each as a component into `src/shared/ui/icon/icons.tsx`: one
`<path>`, no icon library at run time, no style attribute for the CSP to refuse. The output is committed. To add one,
put its name from https://fonts.google.com/icons in the list, run the command and import `<Name>Icon`. Its size comes
from the CSS around it: `size(icon)` 20px in buttons, `size(icon-row)` 24px in rows, `size(icon-tab)` 28px in the tab
bar.

Why this set (2026-10-23): Lucide, the most active, has no filled forms by design. Phosphor has six weights, but its
React package last shipped in May 2025. Heroicons last shipped in November 2024, with about 300 icons. Tabler fills
only part of its set; Fluent's React icons inject styles at run time; Hugeicons is free in one style only; Solar asks
for attribution. Material Symbols has an outlined and a filled form of every icon, Google updates it every week, and
Android's own apps use it. The paths come through Iconify's packages
(`@iconify-json/material-symbols`, `@iconify/utils`), both maintained; `unplugin-icons` was passed over because its
React output needs svgr, last released in August 2023.

### Space, size, shape

- **Spacing** is a 4px grid: steps 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4px to 64px). Page gutter `space(4)`.
- **Touch targets** are at least 44px (HIG, Fluent); primary actions 48px; list rows 60px; at least 8px between
  neighbours.
- **Radius:** 14px on fields, 24px on cards, menus and toasts, and on the message field (half its 48px height, so one
  line is a pill). Buttons, chips and icon buttons are pills or circles. A chart's bar is round only at its data end,
  4px (`radius(mark)`).
- **Elevation:** cards at rest are flat white on the grey canvas, with no border and no shadow. What floats over the
  page - the message field, the tab bar - takes a soft, wide shadow (`--shadow-float`). Anything that overlaps -
  popover, sheet, dialog, toast - takes the overlay shadow (Cloudscape's rule).
- **Tab bar:** a pill floating at the bottom centre over the foot of the page, 64px tall, 88px per tab, 28px icons;
  four tabs, which give up some width on a phone narrower than 392px rather than push the pill off the screen.
  The page runs under it, fading into the canvas behind the bar (`--tab-bar-fade`) and showing through the pill
  blurred (`surface-float`); under reduced transparency the pill is plain white. Only the pill is blurred, a small
  area, and the fade is a plain gradient, so scrolling stays cheap. The page keeps the bar's height as room at its end
  and as scroll padding, so the last row and a focused field always come clear of it (WCAG 2.4.11); on Hôm nay the
  message field sits above that room. The bar and its room go while the keyboard is up. From `md` it stands down the
  left side. The current tab is green with a filled icon and a bolder label; the others are grey and outlined.
- **The wash:** `--wash`, the faint green at the top of a tab's own screen, gone 320px down. Only there; a page
  within a tab is plain canvas, so the wash also says "you are at the top".
- **How the look got here:** the first version took Fluent 2's 8px corners, one bordered list with divider rows and
  a boxed input; on the phone it read as office software ("hơi ERP, company, system, enterprise", the owner,
  2026-10-20). The second took its shapes from Material 3, in blue. The third, this one (2026-10-23), is lighter and
  rounder, in green.
- **Content width** stops at 640px; text never runs wider than about 60 characters.
- **Overlays:** menus are at least 200px wide; toasts take the full width on a phone and 360px from `md`.
- **Sign-in and setup** put their one action at the bottom of a phone screen, at most 400px wide (`size(panel)`).
- **Breakpoints:** mobile first; `md` from 640px, `lg` from 1024px.

### Charts

Drawn in HTML, with no chart library. A bar's length is a `data-share` step from 0 to 100, which `share-steps`
turns into a percentage in SCSS, so nothing needs a `style` attribute, which the CSP refuses. Charts render on the
server with real text, and only the column chart's picking runs in the browser. Libraries looked at (2026-10-25):
Recharts (150 KB gzip, writes `style=""`), Chart.js (70 KB) and uPlot (22 KB, last release 03/2025) draw on canvas,
which a screen reader cannot read; ECharts (368 KB) and ApexCharts (270 KB) are too heavy for a phone.

- **Form by job.** A period's headline numbers are `Stats`, not a chart. Change over time is a column chart. A
  ranking is rows with a bar under each (`ListBar`). A breakdown into one part is not shown at all. Two figures on
  different bases (money in during a period, debt at its end) are never stacked into one bar.
- **Marks.** Columns at most 24px wide and never the whole slot, so the card shows between them; round only at the
  data end; hairline gridlines in `border`. Money is `icon-green`, the meaning it has everywhere (3.14:1 on white,
  above the 3:1 marks need). The picked column turns `accent-text` and its slot is shaded.
- **Axis.** It tops out at 1, 2, 4, 5 or 10 times a power of ten, so the halfway line is round too; numbers are short
  (`500k`, `2,5tr`, `1,2 tỷ`); at most about seven columns carry a label.
- **Reading values.** Text is in text colours, never the series colour. A readout above the plot names one column -
  the highest until another is picked - and holds two lines whatever is picked, so nothing moves. A finger or a mouse
  picks the column under it; the keyboard and screen readers move through the columns with a native
  `<input type="range">`, whose value text is the column's label and value, and whose focus ring is drawn on the plot.
  Every value is also in a table under the chart, behind "Xem dạng bảng".
- **Change.** Against the period before, as a percentage with its sign and an arrow, green up and red down; from ten
  times up, "Gấp 48 lần" instead of "+4653%"; nothing when the period before had nothing.

### Motion

`fast` 120ms for overlays, toasts and inline errors; `slow` 240ms is the ceiling. Easing `out` is
`cubic-bezier(0, 0, 0, 1)`, Cloudscape's responsive curve. Everything animated sits inside `@include motion`, so
reduced motion turns it off.

### App icon

The letters pn, lowercase and white on the accent, drawn as strokes - stems, a bowl and an arch - rather than set in
a font, so the icon needs no font file and stays legible at 16px. `scripts/generate-icons.ts` is its only source:
`pnpm icons` writes `src/app/icon.svg` (the browser tab), `src/app/apple-icon.png` (180px, the iPhone home screen)
and the manifest's PNGs in `public/icons/`, and the output is committed.

- **Rounded** where the icon is shown as drawn (the tab, the manifest's `any` icons); **square** where the phone cuts
  its own shape out of it (Android's `maskable` icon, every icon on iOS).
- The letters sit inside the maskable safe zone, a centred circle with a radius of 40% of the icon, so no launcher
  mask crops them. The p's stem ends are the farthest points; the script's `scale` keeps them inside. `any` and
  `maskable` are separate files, as web.dev advises: a maskable icon used as `any` shows its padding.
- `theme_color` and `background_color` are the canvas, so on Android the status bar and the launch screen match the
  page. iOS draws neither from the manifest the same way; how it looks there is unchecked.

## Components

In `src/shared/ui/<name>/`, one component per file with its styles beside it. They take no `className` or `style`:
a screen arranges components, it does not restyle them. Words that mean the same everywhere - Lưu, Huỷ, Xoá, Tuỳ
chọn - come from `src/shared/ui/action-labels.ts`, never typed again. Every component, in every state, is on
`/dev/ui` while the dev server runs; production answers 404 there. A new component goes on that page in the same
change.

| Component | For | Rules it holds |
|---|---|---|
| `Button` | An action with a text label | A pill. `variant` primary (filled bright green, its label `label-strong`), secondary (default, light grey) or quiet. `tone="danger"` exists only on secondary and quiet, so the type refuses a filled red button. `size` md is 44px, lg 48px for the main action |
| `IconButton` | An action shown as an icon alone | A circle; quiet and muted unless it is the one action the screen exists for, such as send, which takes `variant="primary"` (never with the danger tone). `label` is required: it is the accessible name, the only one there is |
| `IconLink` | Going to another page, shown as an icon alone | Looks exactly like a quiet `IconButton` but is a real link over `next/link`, so a screen reader says "link" and it opens in a new tab. A Base UI button rendered as a link would be announced as a button |
| `SearchField` | The box at the top of a search screen | A pill with a magnifier; `type="search"`, so the browser adds a clear button and the phone keyboard's Enter says search. `label` is the accessible name. Wrapped by the screen in `<search>` and a `next/form` GET form, so a search is a URL that back and reload keep |
| `DayPicker` | Jumping to a date | An icon button that opens the phone's own date picker through `showPicker()`. The input stays rendered under the button, unseen, since `showPicker()` refuses an input that is not rendered and the popover anchors to it |
| `ButtonLink` | Going somewhere, shown as a button with words: "Tạo đơn", "Gọi" | A `Button`'s look over `next/link`, read as a link; a `tel:` link dials. No prefetch unless asked |
| `SelectField` | One choice from a short list | The browser's own `<select>`, labelled like `TextField`: a phone opens its own picker. `emptyLabel` adds a first "none" choice |
| `SuggestField` | Free text with suggestions from the server: a customer, a product | Base UI's Autocomplete, async; a newer answer replaces an older one. The popup opens only with something in it, since an open popup hides the rest of the form from a screen reader; "nothing matches" is said under the field. Built after hydration: its hidden input carries a style attribute the CSP refuses in server HTML |
| `ChipLinks` | One filter at a time: a status, a kind | A grey pill track with the current chip white on it; scrolls sideways when it does not fit. Links, so the filter is in the URL and works before scripts load |
| `ListLink` | A row that opens a page of its own | The whole row is the link, with a chevron, an optional `icon` and `iconTone` leading it, an optional value at the end (`valueTone="danger"` for what is owed). No prefetch |
| `PageHeader` | The top of a screen | Back on the left, the title and a subtitle, actions at the end. Without `back` it is a tab's own screen and the title is large (`display`) |
| `Stats` | A few numbers in one card | A `<dl>`: a small label over a large value, side by side while they fit; a number that does not fit moves to the next line whole, never into its neighbour. `hero` puts the screen's one big number above the rest, in the accent. A stat's `change` says how it moved against an earlier one, with a sign and an arrow as well as the colour |
| `ColumnChart` | A figure over time | Columns as `data-share` steps, a readout above, a native slider for the keyboard and screen readers, a table view under it. See Charts |
| `ListBar` | A row of a ranking | A `List` row with the figure written and a bar under it against the largest row; a link when the row narrows the screen to itself |
| `FilterChips` | The filters in force | Green chips beside what they filter, each a link that drops it; named "Bỏ lọc ..." with the chip's own words in it |
| `Screen` | The column a list or detail screen sits in | Content width, gutters, room at the bottom, one gap. Its single column is `minmax(0, 1fr)`, so a wide field can never push the page sideways. `wash` only on a tab's own screen |
| `TextArea` | Free text | Opens at one line and grows with the text up to 8, then scrolls (`field-sizing: content`; older browsers keep 3 rows). Invalid through `aria-invalid`, the message in a paragraph below, linked with `aria-describedby`. `appearance="bare"` drops its own edge and focus ring to sit inside a field that draws them, such as the message field (which uses `:focus-within`) |
| `TextField` | One line of text, or a password | A label above, an optional `description` hint and an `error` below, both read out with the field. A password field has a show/hide button instead of a second "confirm" field (NIST 800-63B-4) |
| `ActionMenu` | The ... menu on a row | Takes `actions` and an optional `destructive`. The destructive item is always last, below a divider, in the danger color. An action with `href` is a real link (`Menu.LinkItem` over `next/link`) |
| `List`, `ListRow`, `ListAction`, `ListContent` | Grouped settings, as the phone's own | One white card per group, a small `heading` above and an optional `footer` below; rows split by a hairline that starts where the text does, past a leading icon. `ListRow` shows a value large and what it is beneath, with what can be done to it as children, and takes an `icon` and `iconTone` as `ListLink` does. `ListAction` is a row that is itself the action, in the accent (or `tone="danger"`). `ListContent` gives a row over to a field being edited in place |
| `Dialog`, `ConfirmDialog` | A question that must be answered before going on | A sheet at the bottom on a phone, a card in the middle from `md`; focus stays inside until it closes. `ConfirmDialog` is only for what cannot be undone: a question as the title, the verb on the button, never "OK" |
| `Status` | The outcome of an action, in one line | An `<output>`, so a new message is read out without moving focus. Keeps its line when empty, so nothing below jumps |
| `Toaster`, `useToast()` | The result of an action, with Undo when it can be undone | Mounted once in `src/app/layout.tsx`. A plain toast closes after 7 seconds (Fluent); one with an action after 10, and using the action closes it. Phone: full width at the bottom, the action under the title. From `md`: bottom right. A bar docked at the bottom calls `useToastClearance` so toasts sit above it, never on it |
| `EmptyState` | A list with nothing in it | `title` says what is empty, `description` only when it helps, `action` is what fills it |

- **A disabled control says why.** Pass `focusableWhenDisabled` so keyboard and screen-reader users reach it, and
  point `aria-describedby` at the sentence beneath it.
- **Keyboard:** menus open with Enter and move with the arrow keys; Escape closes and returns focus to the trigger.
  F6 moves into the toast region, Tab reaches the toast and its action. Checked on `/dev/ui`.
- **What a note's message became** sits under its words, inside the card and quieter than them
  (`src/features/reading/web/note-reading.tsx`): a line that opens the order or reminder made, its kind in
  `caption-strong` over the summary in the accent; a question with its answers as grey chips the size of filter
  chips, a long name cut with an ellipsis rather than let out of the card; or why it could not be read, with "Đọc
  lại" as a chip. A reading under way says so in place, as a status, never a spinner.
- **Base UI hides a toast's close button from screen readers** (`aria-hidden`) until the toast is focused or
  expanded, but leaves it in the tab order: a button the keyboard reaches and a screen reader never names, which axe
  reports as `aria-hidden-focus`. `Toaster` sets `aria-hidden={false}` on it, so it is always a named button.

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
- Material Symbols: https://fonts.google.com/icons and https://github.com/google/material-design-icons; the paths
  from Iconify: https://iconify.design/docs/icons/json.html
- Material 3 corner tokens, from Google's material-web:
  https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-shape.scss
- `field-sizing`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing
- Maskable icons and their safe zone: https://web.dev/articles/maskable-icon
