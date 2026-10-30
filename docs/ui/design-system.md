# UI guidelines

daybook should look like a product from a team with a real design system - calm, quiet, obviously deliberate - and
never like a generated app. It is a phone app first, so it should feel like one, not like office software: a white
page, clear black type at a modest size, rounded corners, one blue, coloured icons, and room between things. Numbers
come from Material 3, Apple's Human Interface Guidelines and WCAG; interaction rules from Microsoft Fluent 2 and AWS
Cloudscape. Where they disagree, the choice and the reason are stated.

## Principles

**Design for what the user needs right now.** Every screen has one main job and puts it first. On the phone that is one
vertical flow; nothing is shrunk to fit.

**Reflow, don't resize.** A desktop layout is rearranged for the phone, not scaled down. Change the representation
when the space changes: a desktop table becomes a list of rows, a long legend becomes inline labels.

**Disclose progressively.** Summary first, detail on tap. A row shows the one or two values that matter; the rest
waits behind it.

**Color carries meaning.** Surfaces are white and neutral. The blue accent marks the primary action, the current tab,
links and focus, and charts; red means danger. A small icon takes the tone of what it is about - money green, people blue, debt orange
- the same on every screen (see Icon tones), and a word or a shape always says it too, so colour is never the only
cue. No gradient, no glass, no glow, no shadows on cards.

**Fast is a look too.** A tap answers within 100ms (Google's RAIL model): the tab lights at once. The screen in view
stays until the next one is ready, a few hundred milliseconds now, rather than flashing a placeholder; nothing signals
a wait under a second (Nielsen Norman Group).

**Motion only when it explains something.** An overlay entering, a toast appearing, an error pointing at a field.
Never decoration, never on frequent interactions, and none at all under reduced motion.

**Never lose the user's words, and never make them confirm the obvious.** Save first, fix later. A note that could
not be sent goes back into the box; one whose send ended at sign-in, because the session had run out, is kept by the
tab and back in the box after signing in. Saving never asks. Every delete does, in a `ConfirmDialog` that says what
goes and whether it can come back, and then still offers Undo in the result toast (the owner, 2026-10-29, after using
the app: a delete with no question felt careless). Restoring never asks.

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
- **Response time:** a tap changes something on screen within 100ms. Going to another tab lights it at once, and any
  navigation keeps the screen in view until the next is ready, as React advises for routers. Past a second a thin bar
  runs along the top (`NavigationProgress`: Material 3's indeterminate linear progress, 4px; Nielsen Norman Group: no
  indicator under a second, and a quick flash makes people feel they cannot keep up). Every link is an `AppLink`,
  which reports its navigation through `useLinkStatus`; lint refuses `next/link` elsewhere. There is no `loading.tsx`:
  tried on 2026-10-27, its placeholder flashed on every tap ("bấm bất kì action nào cũng load trang loading lên", the
  owner). A screen seen in the last 30 seconds comes from the browser's copy. A change shows as made and is saved
  behind it (`useOptimistic`). Progress shows in place, never as a full-screen spinner.
- **A screen that could not be made** says so in one line with "Thử lại" (`src/app/_errors/error-screen.tsx`, used by
  both `error.tsx` files); inside the tabs the tab bar stays, so she can go elsewhere.
- **Settings is an overview, each section a screen of its own** (Android's settings pattern): short groups of rows,
  each row named as the screen it opens, its second line what it holds now ("2 thiết bị"), never a description.
  Every settings page carries the tab Settings was opened from, so back from a section, then back from Settings,
  ends on that tab. Names are in `src/app/settings/settings-copy.ts`.
- **Nothing waits inside a transition** for a person or for something slow. React holds back every transition's
  updates until all pending ones have ended, so a dialog awaited inside one never draws its own state, and a
  seconds-long call inside one holds up every other update on the page. A dialog that answers a waiting action keeps
  plain state (`src/app/settings/passkey-confirm.tsx`); reading a note with the model is a plain call
  (`src/app/(app)/_day/day-screen.tsx`).

## Tokens

Defined in `src/shared/ui/styles/abstracts/_tokens.scss` (names) and `src/shared/ui/styles/themes/_light.scss`
(color values). Components use them through functions - `color(text-muted)`, `space(4)`, `radius(control)` - and an
unknown name fails the build.

### Color roles

| Role | Value | Used for | Contrast |
|---|---|---|---|
| `canvas` | `#ffffff` | Page background: white, so black text reads at its clearest | |
| `surface` | `#ffffff` | Cards, sheets, inputs; a card is told from the page by its `border` hairline | |
| `surface-float` | `#ffffff` | The tab bar and the message box, over the page; opaque | |
| `surface-subtle` | `#f0f2f5` | A note's bubble, hover and pressed states, disabled controls, the chip track, a screen's outline while it loads, the search box | text 18.17:1, muted 5.05:1, accent text 5.00:1 on it |
| `control-fill` | `#e4e6eb` | A secondary button | text 16.32:1, muted 4.54:1 on it |
| `border` | `#e4e6eb` | Hairlines and the edge of a card | decorative |
| `border-strong` | `#8a8d91` | Input outlines and other control boundaries | 3.33:1 on white |
| `text` | `#050505` | Body text | 16.32:1 or more |
| `text-muted` | `#65676b` | Secondary text, timestamps, tabs not shown | 4.54:1 or more |
| `accent` | `#0866ff` | The fill under white: the primary button, the send button | white on it 4.82:1 |
| `accent-hover` | `#0756d6` | The primary button hovered or pressed | white on it 6.34:1 |
| `accent-text` | `#0064d1` | Blue words: links, the current tab, an action row; the focus ring and a focused field's edge | 5.00:1 or more |
| `accent-wash` | `#ebf3ff` | Behind a choice that is made: a filter chip, a pressed toggle; an unread row | accent text 5.02:1, muted 5.07:1 on it |
| `on-accent` | `#ffffff` | Text on the accent | 4.82:1 |
| `danger` | `#c2181d` | Destructive actions, errors; a badge | 4.75:1 or more |
| `on-danger` | `#ffffff` | A badge's number | 4.75:1 |
| `scrim` | `text` at 40% | Dims the page behind a dialog | not read on |
| `icon-*` | see Icon tones | An icon's colour by what it is about | 3:1 or more on white |

**One blue, two shades.** `accent` is bright enough to be the app's colour and still holds white text at 4.82:1, so a
button's label can be any size. Blue words use the deeper `accent-text`, which keeps 4.5:1 on the greys too (on
`#f0f2f5`, `accent` itself is 4.30:1).

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

Inter with the Vietnamese subset (Geist, a common default, has no Vietnamese glyphs), one variable file for every
weight.

| Style | Material 3 style | Size / line height, weight | Use |
|---|---|---|---|
| `badge` | label-small | 11 / 16, 500 | A badge's number, and nothing else |
| `caption` | body-small | 12 / 16, 400 | The smallest words get: small print, a time |
| `caption-strong` | label-medium | 12 / 16, 500 | Tab labels |
| `body-sm` | body-medium | 14 / 20, 400 | Secondary lines, a row's second line |
| `body` | body-large | 16 / 24, 400 | Default, and every input: under 16px iOS zooms into the field |
| `body-strong` | title-medium | 16 / 24, 500 | An unread row's title |
| `label` | label-large | 14 / 20, 500 | A field's label, a group's name |
| `label-strong` | label-large | 14 / 20, 500 | A button's words |
| `title` | title-large | 22 / 28, 400 | A page's title in the bar, a dialog's |
| `display` | headline-small | 24 / 32, 400 | A tab's own screen title, under the bar |
| `hero` | headline-medium | 28 / 36, 400 | A screen's one big number, in `text` |

Material 3's type scale exactly, from material-web's `md-sys-typescale` tokens: headings are regular weight, labels
medium, nothing bold. The version before (2026-10-23) used Apple's 17px body with 17px bold labels and bold titles up to
36px; on the owner's phone labels such as "Đơn giá" and titles such as "Đơn hàng" read too big, and a title wrapped.
Every size is in `rem`, and no screen may scroll sideways with text at twice its size (WCAG 1.4.4, `e2e/layout.feature`).

### Icons

Material Symbols Rounded (Google, Apache-2.0), weight 400 on its 24-unit grid. Outlined by default; filled for the
current tab and the icon leading a row, as Material marks what is chosen. `scripts/generate-symbols.ts`
lists the icons the app uses, and `pnpm symbols` writes each as a component into `src/shared/ui/icon/icons.tsx`: one
`<path>`, no icon library at run time, no style attribute for the CSP to refuse. The output is committed. To add one,
put its name from https://fonts.google.com/icons in the list, run the command and import `<Name>Icon`. Its size comes
from the CSS around it: `size(icon)` 20px in buttons, `size(icon-row)` 24px in rows, `size(icon-tab)` 24px in the tab
bar.

Why this set (2026-10-23): Lucide, the most active, has no filled forms by design. Phosphor has six weights, but its
React package last shipped in May 2025. Heroicons last shipped in November 2024, with about 300 icons. Tabler fills
only part of its set; Fluent's React icons inject styles at run time; Hugeicons is free in one style only; Solar asks
for attribution. Material Symbols has an outlined and a filled form of every icon, Google updates it every week, and
Android's own apps use it. The paths come through Iconify's packages
(`@iconify-json/material-symbols`, `@iconify/utils`), both maintained; `unplugin-icons` was passed over because its
React output needs svgr, last released in August 2023.

### Space, size, shape

- **Spacing** is a 4px grid: steps 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4px to 64px). Page gutter `space(4)`; 32px
  between a screen's groups, 24px between a form's fields, 8px between a label and its box, 20px inside a card. Small
  controls, generous room: a long screen scrolls, it is never squeezed to fit one.
- **Sizes** are Material 3's, from material-web's component tokens: buttons and icon buttons 40px, list items 56px,
  chips 32px, the top app bar 64px, the floating action button 56px. The navigation bar is Material 3 Expressive's,
  64px with a 56 x 32 pill behind the current icon (material-components-android, `BottomNavigation.md`). One
  deliberate step away: fields are 40px, not Material's 56px, because the owner found the boxes too big. The action a
  screen exists for is 44px. All clear WCAG 2.5.8's 24px target with room between neighbours.
- **Radius:** 10px on fields, 16px on cards, menus and toasts, 22px on the message box (half its height, so one line
  is a pill), 16px on the floating action button (Material's `corner-large`). Buttons, chips and icon buttons are
  pills or circles. A chart's bar is round only at its data end, 4px (`radius(mark)`).
- **Elevation:** cards at rest are flat, edged by a `border` hairline on the white page, with no shadow. A note is a
  grey bubble, as a message is in a chat. Anything that overlaps - popover, sheet, dialog, toast - takes the overlay
  shadow (Cloudscape's rule).
- **Focus:** a field being typed in turns its own edge blue and doubles it on the inside (`field-focus`); there is no
  second ring around it. Everything else shows a 2px `accent-text` ring outside it on keyboard focus only
  (`focus-ring`).
- **Tab bar:** a white bar along the foot of the screen, a hairline above it, 64px tall, the four places sharing its
  width, 24px icons. The page ends above it, so nothing passes under it and nothing has to keep room for it. It goes
  while the keyboard is up. From `md` it stands down the left side. The current tab is blue, its icon filled on a
  light blue pill; the others are grey and outlined. Labels keep one weight, as Material 3 Expressive has them.
- **How the look got here:** the first version took Fluent 2's 8px corners, one bordered list with divider rows and
  a boxed input; on the phone it read as office software ("hơi ERP, company, system, enterprise", the owner,
  2026-10-20). The second took its shapes from Material 3, in blue. The third (2026-10-23) was lighter and rounder, in
  green, on a grey page, with a green wash at the top of each tab and a frosted tab bar. The fourth, this one
  (2026-10-27), came from the owner using it on his phone: "font quá to, components quá to", things "dính sát vào
  nhau", "nền không cần xám", no gradient. So: a white page, blue, Material's sizes, more room between groups, and no
  wash or glass.
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
  data end; hairline gridlines in `border`. Marks are `accent` (4.82:1 on white, above the 3:1 marks need), as are a
  ranking's bars; the owner wanted no green on the big surfaces (2026-10-27). The picked column turns `accent-text` and
  its slot is shaded.
- **Axis.** It tops out at 1, 2, 4, 5 or 10 times a power of ten, so the halfway line is round too; numbers are short
  (`500k`, `2,5tr`, `1,2 tỷ`); at most about seven columns carry a label.
- **Reading values.** Text is in text colours, never the series colour. A readout above the plot names one column -
  the highest until another is picked - and holds two lines whatever is picked, so nothing moves. A finger or a mouse
  picks the column under it; the keyboard and screen readers move through the columns with a native
  `<input type="range">`, whose value text is the column's label and value, and whose focus ring is drawn on the plot.
  Every value is also in a table under the chart, behind "Xem dạng bảng".
- **Change.** Against the period before, as a percentage with its sign and an arrow, blue up and red down; from ten
  times up, "Gấp 48 lần" instead of "+4653%"; nothing when the period before had nothing.

### Motion

`fast` 120ms for overlays, toasts and inline errors; `slow` 240ms is the ceiling. Easing `out` is
`cubic-bezier(0, 0, 0, 1)`, Cloudscape's responsive curve. Everything animated sits inside `@include motion`, so
reduced motion turns it off.

### App icon

The letters pn, lowercase and white on the accent, drawn as strokes - stems, a bowl and an arch - rather than set in
a font, so the icon needs no font file and stays legible at 16px. `scripts/generate-icons.ts` is its only source:
`pnpm icons` writes `public/icon.svg` (the browser tab), `public/apple-icon.png` (180px, the iPhone home screen),
the manifest's PNGs in `public/icons/` and `public/manifest.webmanifest` from `src/app/web-manifest.ts`, and the
output is committed. All static, so asking for them never wakes the Worker.

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
| `Button` | An action with a text label | A pill, its words `label-strong`. `variant` primary (filled blue), secondary (default, light grey) or quiet. `tone="danger"` exists only on secondary and quiet, so the type refuses a filled red button. `size` md is 40px, lg 44px for the main action |
| `IconButton` | An action shown as an icon alone | A circle; quiet and muted unless it is the one action the screen exists for, such as send, which takes `variant="primary"` (never with the danger tone). `label` is required: it is the accessible name, the only one there is |
| `IconLink` | Going to another page, shown as an icon alone | Looks exactly like a quiet `IconButton` but is a real link over `next/link`, so a screen reader says "link" and it opens in a new tab. A Base UI button rendered as a link would be announced as a button. An optional `badge` puts a count over the icon: Material 3's large badge as material-web sizes and places it (16px, `danger` under `on-danger`, `badge` type), "99+" past two digits; it is hidden from screen readers, so the `label` says the count too |
| `SearchField` | The box at the top of a search screen | A grey pill with a magnifier, its input one character wide of its own (`size="1"`) so it never holds the page wider than the screen; `type="search"`, so the browser adds a clear button and the phone keyboard's Enter says search. `label` is the accessible name. Wrapped by the screen in `<search>` and a `next/form` GET form, so a search is a URL that back and reload keep |
| `DayPicker` | Jumping to a date | An icon button that opens the phone's own date picker through `showPicker()`. The input stays rendered under the button, unseen, since `showPicker()` refuses an input that is not rendered and the popover anchors to it |
| `ButtonLink` | Going somewhere, shown as a button with words: "Tạo đơn", "Gọi" | A `Button`'s look over `next/link`, read as a link; a `tel:` link dials. No prefetch unless asked |
| `SelectField` | One choice from a short list | The browser's own `<select>`, labelled like `TextField`: a phone opens its own picker. `emptyLabel` adds a first "none" choice |
| `SuggestField` | Free text with suggestions from the server: a customer, a product | Base UI's Autocomplete, async. The server is asked once the typing pauses for 250ms, not at every key (it was two or three requests a field), and outside any transition; a newer answer replaces an older one. The popup opens only with something in it, since an open popup hides the rest of the form from a screen reader; "nothing matches" is said under the field. Built after hydration: its hidden input carries a style attribute the CSP refuses in server HTML |
| `ChipLinks` | One filter at a time: a status, a kind | A grey pill track with the current chip white on it; scrolls sideways when it does not fit. Links, so the filter is in the URL and works before scripts load |
| `ListLink` | A row that opens a page of its own | The whole row is the link, with a chevron, an optional `icon` and `iconTone` leading it, an optional value at the end (`valueTone="danger"` for what is owed). No prefetch. `unread` marks a row new to the person: `accent-wash` behind it, a heavier title, and its words ("Chưa đọc") read out first, so colour is not all that says so. A detail keeps its line breaks |
| `PageHeader` | The top of a screen, drawn by `Screen` from its `title`, `subtitle`, `back` and `actions` | Material's small top app bar, 64px, that sticks while the page scrolls under it, back on the left and actions at the end; a hairline under it once the page has scrolled. Without `back` it is a tab's own screen: the title is large (`display`) under the bar, and moves into the bar (a fade, nothing else) once it has scrolled under it |
| `FabLink` | What a list screen adds: an order, a customer | Material's floating action button: 56px, blue, 16px corners, over the foot of the screen above the tab bar, its accessible name in `label`. One per screen; the column keeps room for it so the last row comes clear |
| `Stats` | A few numbers in one card | A `<dl>`: a small label over a large value, side by side while they fit; a number that does not fit moves to the next line whole, never into its neighbour. `hero` puts the screen's one big number above the rest, larger, in the text colour. A stat's `change` says how it moved against an earlier one, with a sign and an arrow as well as the colour |
| `ColumnChart` | A figure over time | Columns as `data-share` steps, a readout above, a native slider for the keyboard and screen readers, a table view under it. See Charts |
| `ListBar` | A row of a ranking | A `List` row with the figure written and a bar under it against the largest row; a link when the row narrows the screen to itself |
| `FilterChips` | The filters in force | Blue chips beside what they filter, each a link that drops it; named "Bỏ lọc ..." with the chip's own words in it |
| `Screen` | A list or detail screen: its header, then the column its groups sit in | The header outside the column, so its bar sticks for the whole page; then content width, gutters, room at the bottom (more when a `FabLink` is on the screen), 32px between groups. Its single column is `minmax(0, 1fr)`, so a wide field can never push the page sideways |
| `TextArea` | Free text | Opens at one line and grows with the text up to 8, then scrolls (`field-sizing: content`; older browsers keep 3 rows). Invalid through `aria-invalid`, the message in a paragraph below, linked with `aria-describedby`. `appearance="bare"` drops its own edge and focus ring to sit inside a field that draws them, such as the message field (which uses `:focus-within`) |
| `TextField` | One line of text, or a password | A label above, an optional `description` hint and an `error` below, both read out with the field. A password field has a show/hide button instead of a second "confirm" field (NIST 800-63B-4) |
| `ActionMenu` | The ... menu on a row | Takes `actions` and an optional `destructive`. The destructive item is always last, below a divider, in the danger color. An action with `href` is a real link (`Menu.LinkItem` over `next/link`) |
| `List`, `ListRow`, `ListAction`, `ListContent` | Grouped settings, as the phone's own | One card per group, edged by a hairline, a small `heading` above and an optional `footer` below; rows split by a hairline that starts where the text does, past a leading icon. `ListRow` shows a value large and what it is beneath, with what can be done to it as children, and takes an `icon` and `iconTone` as `ListLink` does. `ListAction` is a row that is itself the action, in the accent (or `tone="danger"`). `ListContent` gives a row over to a field being edited in place |
| `Dialog`, `ConfirmDialog`, `useConfirm` | A question that must be answered before going on | A sheet at the bottom on a phone, a card in the middle from `md`; focus stays inside until it closes. `ConfirmDialog` comes before every delete: a question as the title ("Xoá ghi chú này?"), what goes and whether it comes back beneath, the verb on the button, never "OK"; `tone="neutral"` when the answer offered is not a delete, such as hiding a product orders name. `useConfirm()` awaits it where the delete is, outside any transition |
| `ListCheck` | A row while choosing many | The whole row is the label of a Base UI checkbox, Material 3's (material-web `md-comp-checkbox`: 18px box, 2px corners, 2px outline, filled with the accent once ticked); a chosen row takes `accent-wash`. Drawn only while choosing, in the browser, since Base UI's hidden input carries a style attribute the CSP refuses in server HTML. The first row of a list being chosen from is "Chọn tất cả", mixed while some are |
| `SelectionBar`, `useSelection` | The actions on what is chosen | Docked at the foot of the page while choosing, sticky inside the scrolling page, so it sits above the tab bar; buttons side by side, the destructive one in the danger tone; toasts rise above it. With nothing ticked its buttons act on everything shown ("Khôi phục tất cả", "Xoá tất cả"), as a phone's Recently Deleted does |
| `Status` | The outcome of an action, in one line | An `<output>`, so a new message is read out without moving focus. Keeps its line when empty, so nothing below jumps |
| `Toaster`, `useToast()` | The result of an action, with Undo when it can be undone | Mounted once in `src/app/layout.tsx`. A plain toast closes after 7 seconds (Fluent); one with an action after 10, and using the action closes it. Phone: full width at the bottom, the action under the title. From `md`: bottom right. A bar docked at the bottom calls `useToastClearance` so toasts sit above it, never on it |
| `EmptyState` | A list with nothing in it | `title` says what is empty, `description` only when it helps, `action` is what fills it |
| `Notice` | A record's state, said first on its page: deleted, hidden, merged | One line on the surface, muted, or `tone="danger"` for something gone from where it belongs; the way back or onward (a button, a link) beside it |
| `QuietLink` | A way to something rarely needed, under a list: the hidden customers, the next page | Muted, underlined, centred, still a full-height target; no prefetch |

- **Names and merges** (`src/app/(app)/_names`, `_merge`): `OtherNames` is the card of a customer's or product's
  other names, each removed with one tap, added through `NameDialog`, the one-field dialog that also adds and renames
  a product. `MergeDialog` is the only change that asks before it acts, because a merge has no Undo: pick the one to
  keep from suggestions that leave out the one being merged, then a `ConfirmDialog` that says what will move.
- **Choosing many** (the trash, the bell's list): "Chọn" in the header starts it, the title becomes "Đã chọn 3" and
  "Xong" ends it; rows turn into `ListCheck`s under a "Chọn tất cả" row, and a `SelectionBar` holds the actions. A row
  of the trash also has its own menu - Khôi phục, Xoá vĩnh viễn - for one at a time. Words in
  `src/shared/ui/selection-bar/selection-copy.ts`.
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
