# Domain

The model behind the product, in the words the code uses. [design.md](../product/design.md) says what the product
does; this file says how the data is shaped and which rules it keeps. A change to the data model is proposed here first.

## Words

| Term | In the app | Meaning |
|---|---|---|
| Capture | tin gõ vào | What was sent, exactly as sent, with where it came from and when. Never changes |
| Note | ghi chú | An entry in the list. Starts as a capture's words; it can be edited, deleted and restored |
| Content | nội dung | The user's text. Not blank, at most 4,000 characters, otherwise kept exactly as typed: spaces, line breaks, diacritics |
| Source | | Where a capture came in: `web` or `telegram` |
| Day | ngày | A calendar day in `Asia/Ho_Chi_Minh`. A day's notes are those created from its first instant up to the next day's |
| Audit | | Who made a record and when, who changed it last and when, and its version. On every record people change |
| Version | | How many times a record has been saved. A change carries the version its screen showed; a stale one is refused |
| Search text | | A note's words as a search matches them: no diacritics, `đ` as `d`, lower case, single spaces |
| Account | tài khoản | One of the two people using the book. A lower-case username for the fallback password, a display name, a random WebAuthn user handle |
| Passkey | Face ID, vân tay | The way in: a WebAuthn credential bound to this app's host |
| Session | thiết bị đã đăng nhập | One signed-in browser. Lives 30 days from the sign-in that opened it |
| Setup link | link cài đặt | A one-time, ten-minute link: the first setup (from the command line), an invite, or a recovery for someone who lost every way in |
| Ceremony | | A sign-in step a browser is part-way through, tied to that browser |
| Step-up | xác nhận lại | A sign-in in the last five minutes, which security settings ask for |
| Fallback password | mật khẩu dự phòng | For a browser without passkeys. Optional; never sent, only a key derived from it |
| Invite | link mời | A setup link for someone new, made by a signed-in user; the newcomer names the account |
| Recovery link | link khôi phục | A setup link for the other user's account, when they lost every way in |
| Access event | hoạt động đăng nhập | A record of who signed in, what changed, and from where. Never edited |

| Customer kind | loại khách | The owner's own grouping of customers, typed into Settings. The code names none of them |
| Customer | khách | Someone orders are for: a name, and optionally a kind, an area, a phone, an address, a note. Hidden, never deleted |
| Product | món hàng | Something sold, made the first time an order names it. "Thuốc tê" and "thuoc te" are one product |
| Order | đơn | A customer's order on a day: its lines, its delivery day, its payments. Its total is the sum of its lines |
| Payment | lần thu | Money taken for an order, on a day, by cash or transfer. Never edited: removed with who and when |
| Owed | còn nợ | An order's total less its live payments, never below zero; a customer owes the sum over their live orders |
| Order change | lịch sử | One entry of an order's log: who, when, what kind, and the order before and after |

Planned, not built:

| Term | Meaning |
|---|---|
| Interpretation | How a model read a capture: what it thinks was meant, which model, how sure. Many per capture - reading again with a better model adds one, never overwrites |
| Reminder, Interaction | What an interpretation turns into, beside orders. Each keeps the `capture_id` it came from |

## Why a capture and a note, not one row

The words and the entry worked with obey different rules. As one row, editing an entry would destroy the only
record of what was sent, and re-reading old messages with a better parser - the reason `capture` exists, see
design.md "Data" - would read the corrections instead of the words.

So the capture is the evidence and the note is the working copy. Today a note is a plain copy of the capture; once
parsing exists, the entries shown are derived from captures the same way.

## Capture

- Made by `receive(content, source, authorId, receivedAt)` in `src/features/capture/domain/capture.ts`. There is no other
  operation.
- Never updated, never deleted. The type is readonly and has no function that changes it; in the database, two
  triggers abort any `UPDATE` or `DELETE` on `capture`, so a hand-written query cannot break the rule either.
- `source` is a known value and `content` is not blank, checked by the type and again by `CHECK` constraints.

## Note

A note is either live or deleted: `LiveNote | DeletedNote`, discriminated by `status`. A function that needs a live
note says so in its type. The transitions are pure functions in `src/features/notes/domain/note.ts`:

| Function | From | Gives |
|---|---|---|
| `fromCapture` | a capture | a live note with the capture's words, made by its author at its time, version 1 |
| `edit` | live | live, with the new content; a change by the editor |
| `edit` | deleted | `note_deleted` |
| `markDeleted` | live | deleted, with who deleted it and when; a change by them |
| `markDeleted` | deleted | the same note, unchanged: deleting is undoable, so deleting twice is harmless |
| `restore` | deleted | live, with its words and creation; a change by whoever restored it |
| `restore` | live | `note_not_deleted` |

- The creation never moves. `createdAt` is the capture's `receivedAt`, so a note stays on the day it was sent, and
  `createdBy` is who typed it.
- Each change moves `updatedAt`, sets `updatedBy` and adds one to the version (`src/shared/domain/audit.ts`).
- Every note points at its capture through `capture_id`, a foreign key.

## Audit

Every record people change carries the same audit (ADR 0011, decision 9): `createdAt`, `createdBy`, `updatedAt`,
`updatedBy`, `version`, and, when it can be deleted, `deletedAt` with `deletedBy`. There is no `is_deleted` column;
a record is deleted when `deletedAt` is set, and the type says so (`DeletedNote`).

The audit says who and when, not what. Records whose history matters - orders and payments - keep a change log of their
own (decision 10). A note does not: its capture keeps the words as first sent.

## Customers and kinds

`src/features/customers/`. Both are hidden (`archived_at`, `archived_by`) rather than deleted: old orders still show
who they were for.

- A kind's name is unique among the shown ones, ignoring case and diacritics; a hidden kind frees its name, and comes
  back only if the name is still free. New kinds go last.
- A customer's details are parsed from the form: the name is required, the rest optional and stored as null when
  empty, never "". Two customers may share a name; the list shows the kind and area beneath to tell them apart.
- A customer is given only a shown kind, unless it already had the one now hidden.
- `search_name` is the name and area as a search matches them; the list sorts by it, so "Ánh" sits beside "Anh".

## Orders

`src/features/orders/`. An order is one aggregate: its lines and its payments change with it, under the order's
version, so "paid never exceeds the total" is kept in one place and two people cannot break it at once.

| Function | Refuses with |
|---|---|
| `place` | `order_too_large` (a line or the total past what money holds) |
| `revise` | `order_deleted`, `order_too_large`, `total_below_paid`, `delivered_before_ordered` |
| `deliver`, `undeliver` | `order_deleted`, `delivered_before_ordered` |
| `addPayment` | `order_deleted`, `payment_exceeds_owed` |
| `removePayment` | `order_deleted`, `payment_not_found` |
| `markDeleted`, `restore` | `order_not_deleted` (restore) |

- **Money is a whole number of đồng** (`src/shared/domain/money.ts`), at most a trillion. The total is computed from
  the lines every time and never stored.
- **Business days are Vietnam calendar days**, `YYYY-MM-DD`: ordered, delivered, paid. A delivery is never before the
  order.
- **Products come from the order form.** A line names a known product by id or a new one by name; a name matching a
  shown product, ignoring case and diacritics, is that product. New ones are written in the order's batch.
- **A product's last price is read, not stored**: the latest live line, this customer's first.
- **Every change is logged** (`order_change`, ADR 0011 decision 10): `placed`, `revised`, `delivered`, `undelivered`,
  `payment_added`, `payment_removed`, `deleted`, `restored`, with the order before and after as JSON. `OrderWrites`
  takes the entry with every write, so no change is stored without it. The page reads the log in words
  (`history-text.ts`).
- **A form-made order has no `capture_id`**; it is set when a message became the order (decision 5).

## Access

Two people share one book; `src/features/access/` decides who is signing in. The decisions and their sources are in
design.md, "Sign-in". The rules the code keeps:

- **No secret is stored as itself.** A session cookie is `<session id>.<secret>`; a setup link carries a token in its
  URL fragment; a ceremony is tied to a browser by a cookie. Each secret is 256 random bits, and only its SHA-256 is
  kept, compared in constant time. A fast hash is enough for random secrets of that size.
- **A session exists only because someone authenticated.** `enlistNewSession` is called by the use cases that
  authenticate, never by an adapter, and it queues the session on their unit of work: a sign-in commits whole or not at
  all. Every sign-in gets a new session id; the browser's previous session ends in the same commit.
- **A session ends 30 days after its sign-in**, however often it is used. `lastSeenAt` moves at most hourly and only
  feeds the device list.
- **A setup link works once and for ten minutes.** Used, expired and unknown links get the same answer, so a link
  reveals nothing. The database refuses a second redemption too, in case two arrive at once.
- **What a link carries depends on its purpose**: an invite names no account until it is redeemed; a first-setup link
  has no author, since only the command line issues one.
- **A passkey is discoverable and user-verified**, signed for this app's origin and RP ID, with no attestation asked
  for. The person never types a username to use one: the passkey says whose it is.
- **A passkey prompt is answered once.** Each prompt carries a 32-byte challenge; the first answer spends it before
  it is checked, and a second answer finds nothing. A setup asks for a new prompt each time, until the setup expires;
  a sign-in prompt lasts five minutes. Prompts left unanswered are swept when the next one starts.
- **A setup ends in a signed-in session** with the new passkey. A recovery setup also ends every other session of the
  account. An invite cannot set up a passkey until the newcomer has named the account.
- **An invite's account is named on the ceremony, not the link.** The newcomer gives a display name and a username;
  the account is made then, and the setup ceremony carries it to the passkey. The redeemed link row is never touched
  (`setup_link_redeemed_once` refuses any update), and `account_created` records which link and who invited. An
  account left without a passkey shows as "chưa có cách đăng nhập" until the other user sends a recovery link.
- **A recovery link is for the other user**, never for oneself: signed in, one adds a passkey from Settings. Using it
  adds a passkey and ends every other session of that account; old passkeys stay for their owner to remove.
- **The fallback password never leaves the browser.** The browser normalises it (NFKC), counts code points (15 to
  128), checks Pwned Passwords by k-anonymity with padding, and derives a key with Argon2id (19 MiB, 2 passes, 1 lane,
  a salt the server chose). The server keeps `HMAC-SHA256(pepper, key)` with the pepper's version and compares in
  constant time. An unknown username gets a decoy salt derived from the pepper, so the answers look the same. 100
  failures in a row lock the password; passkeys keep working. Sign-in is limited per client (20 in 10 minutes) and
  per username (10 in 15 minutes).
- **Security settings need a recent sign-in** (step-up, five minutes): adding or removing a passkey, setting the
  password, changing the username, ending sessions, invites and recovery links. Confirming is a passkey sign-in scoped
  to the account, or the password for an account with no passkey; either opens a fresh session in place of the old.
  The server decides; the page only asks when told.
- **The last way in stays.** A passkey can be removed only while another passkey or an unlocked password remains.
- **Each account sees its own activity**: what happened to it, and what it did to the other account. A recovery link
  shows on both lists, each from its own side.
- **The signature counter is a signal, not a lock.** One that did not move forward is noted on the session's
  `session_opened` event and accepted: synced passkeys always report 0.
- **Every attempt is counted and recorded.** Redeeming a link is limited to 10 tries per client in 10 minutes, and
  asking for a sign-in prompt to 30, a client being an IPv4 address or an IPv6 /64. Successes, refusals and limits
  land in `access_event`, with the reason a passkey was refused. A request with no prompt behind it is refused
  without an entry.

## Use cases

One file each in the feature's `application/` folder (`src/features/capture/`, `src/features/notes/`), reached
through `createApp` in `src/composition/create-app.ts`.

| Use case | Does | Can refuse with |
|---|---|---|
| `recordCapture` | Stores the capture and its note together | - |
| `editNote` | Replaces a live note's content | `note_not_found`, `note_deleted`, `note_changed_elsewhere` |
| `deleteNote` | Soft-deletes a note | `note_not_found`, `note_changed_elsewhere` |
| `restoreNote` | Brings a deleted note back | `note_not_found`, `note_not_deleted`, `note_changed_elsewhere` |
| `listNotesForDay` | A day's live notes, newest first | - |
| `searchNotes` | Live notes holding every word typed, newest first, 50 at most and whether there are more | - |
| `addCustomerKind`, `renameCustomerKind` | A kind, last in the list; a new name | `kind_name_taken`, `kind_not_found`, `kind_changed_elsewhere` |
| `archiveCustomerKind`, `restoreCustomerKind` | Hides a kind from the form; shows it again | `kind_archived`, `kind_not_archived`, `kind_name_taken` |
| `addCustomer`, `reviseCustomer` | A customer, with a shown kind | `kind_not_found`, `kind_archived`, `customer_changed_elsewhere` |
| `archiveCustomer`, `restoreCustomer` | Hides a customer from the lists; shows them again | `customer_archived`, `customer_not_archived` |
| `listCustomers` | By name, filtered by words, kind and shown or hidden; 200 at most | - |
| `placeOrder`, `reviseOrder` | An order, making the products it names first | `customer_unavailable`, `product_not_found`, the order's own refusals |
| `deliverOrder`, `undeliverOrder`, `addPayment`, `removePayment` | One change, logged | `order_not_found`, `order_changed_elsewhere`, the order's own refusals |
| `deleteOrder`, `restoreOrder` | Soft delete with Undo; deleting twice writes nothing | `order_not_found`, `order_changed_elsewhere` |

Reads for screens - an order list, its totals, what each customer owes, a customer's account, last prices, an
order's log - are SQL in `order-queries.ts`, one or two statements a screen, inside D1's 50 queries per request on
the free plan.
| `authenticate` | The session behind a cookie; records its use at most hourly | `unauthenticated` |
| `redeemSetupLink` | Spends a setup link and starts a setup ceremony bound to this browser | `setup_link_unusable`, `rate_limited` |
| `startPasskeySetup` | The passkey prompt for a setup, with a new challenge | `setup_link_unusable` |
| `finishPasskeySetup` | Stores the new passkey and signs in with it | `setup_link_unusable`, `passkey_not_accepted` |
| `startPasskeySignIn` | A sign-in prompt for any passkey, or for one account's in a step-up | `rate_limited` |
| `finishPasskeySignIn` | Checks the passkey's answer and opens a session, replacing the browser's old one | `passkey_not_accepted` |
| `beginPasswordSignIn` | The salt and cost for a username, real or decoy; rate limited | `rate_limited` |
| `finishPasswordSignIn` | Checks the derived key and opens a session; counts failures, locks at 100 | `password_not_accepted` |
| `signOut` | Ends this session | - |
| `endSession` | Ends one other session of the account | `step_up_required`, `not_found` |
| `endOtherSessions` | Ends every other session of the account | `step_up_required` |
| `listSessions` | The account's sessions, most recently used first | - |
| `accountOverview` | Everything Settings shows: account, passkeys, password status, sessions, activity, people | - |
| `changeDisplayName` | Renames the account | - |
| `changeUsername` | Changes the username | `step_up_required`, `username_taken` |
| `beginPasswordChange` | A new salt for a new fallback password | `step_up_required` |
| `finishPasswordChange` | Stores the verifier of the new password, unlocked | `step_up_required`, `password_not_saved` |
| `startAddingPasskey` | A creation prompt for another passkey, excluding those the account has | `step_up_required` |
| `finishAddingPasskey` | Stores it | `step_up_required`, `passkey_not_accepted` |
| `removePasskey` | Removes one, never the last way in | `step_up_required`, `not_found`, `last_way_in` |
| `issueSetupLink` | A setup link and its token, shown once; the command line's first setup and break-glass | - |
| `issueInvite` | An invite from a signed-in user | `step_up_required` |
| `issueRecoveryLink` | A recovery link for the other account | `step_up_required`, `not_found` |
| `nameInvitedAccount` | Makes the invited account from the newcomer's name and username | `setup_link_unusable`, `username_taken` |
| `resumeSetup` | Where a setup stands, from its ceremony cookie, after a reload | `setup_link_unusable` |

Each feature's codes form one closed set - `NoteError` in `src/features/notes/application/note-errors.ts`,
`AccessError` in `src/features/access/application/access-errors.ts` - each with the Vietnamese sentence the user
sees. "Can refuse" is an expected outcome, returned as a `Result`; a database that is down is a fault and throws.

## Tables

`capture`, `STRICT`:

| Column | Type | Rule |
|---|---|---|
| `id` | text | primary key, UUIDv7 |
| `content` | text | not blank |
| `source` | text | `web` or `telegram` |
| `author_id` | text | foreign key to `account.id`: who typed it |
| `received_at` | integer | epoch milliseconds |

Triggers `capture_no_update` and `capture_no_delete` abort with "capture is append-only".

`note`, `STRICT`:

| Column | Type | Rule |
|---|---|---|
| `id` | text | primary key, UUIDv7 |
| `capture_id` | text | foreign key to `capture.id` |
| `content` | text | not blank |
| `search_text` | text | `searchText(content)`, written with every change of the content |
| `created_at`, `updated_at` | integer | epoch milliseconds; updated never before created |
| `created_by`, `updated_by` | text | foreign keys to `account.id` |
| `version` | integer | 1 or more |
| `deleted_at`, `deleted_by` | integer, text | both null while live, both set once deleted |

Indexes: `note_live_by_created_at` on `created_at`, partial on `deleted_at is null`, serves the day list;
`note_by_capture` serves tracing a capture to its notes. A search reads every live note's `search_text` with one
`LIKE` per word: a scan, which a book of a few thousand notes a year finishes well inside a request.

Triggers: `note_version_moves_by_one` aborts with `stale_version` unless an update sets the version to the stored one
plus one; `note_creation_is_fixed` aborts with `creation_is_fixed` if `created_at` or `created_by` would change.

The book's tables, all `STRICT`, every one but the lines and the log with the audit columns and both triggers
(`audited-tables.test.ts` finds any table with a `version` that lacks them):

| Table | Holds | Rules the database keeps |
|---|---|---|
| `customer_kind` | name, search name, position | name 1-40; shown names unique by search name |
| `customer` | name, search name, kind, area, phone, address, note | lengths; optional details null, never "" |
| `product` | name, search name | shown names unique by search name |
| `sales_order` | customer, ordered on, delivered on, note, capture | days are `YYYY-MM-DD`; delivered on or after ordered |
| `order_line` | order, position, product, quantity, unit price | quantity 1-100,000; price 0 to a trillion; no audit, replaced whole on a revision |
| `payment` | order, amount, paid on, method, note, who and when recorded, removal | amount 1 to a trillion; method `cash`, `transfer` or none; trigger `payment_only_removal`, `payment_no_delete` |
| `order_change` | order, kind, who and when, before and after as JSON | known kinds; valid JSON; triggers `order_change_no_update`, `order_change_no_delete` |

The access tables, all `STRICT`, ids UUIDv7, times epoch milliseconds, secrets as the base64url of their SHA-256.
Every number a `CHECK` holds - lengths, the Argon2id floor, the algorithms - is the domain's own constant, written
into the statement by `src/shared/infrastructure/d1/sql-literals.ts`, so the two cannot drift:

| Table | Holds | Rules the database keeps |
|---|---|---|
| `account` | username, display name, WebAuthn user handle | username unique, lower-case `a-z0-9._-`, 3-32 long |
| `passkey` | a credential's id, public key, algorithm, counter, transports, backup flags, name, last use | credential id unique; algorithm ES256, Ed25519 or RS256 |
| `session` | the verifier, how it signed in, when it started, ends and was last seen, the device label | a password session names no passkey; it ends after it starts |
| `setup_link` | purpose, account, author, token hash, expiry, redemption | an unredeemed invite names no account; a first-setup link has no author; trigger `setup_link_redeemed_once` |
| `password` | one fallback password per account: salt, Argon2id cost, verifier, pepper version, failures, lock, change time | the cost never below OWASP's minimum; salt and verifier of their exact lengths |
| `ceremony` | kind, browser binding, account, setup link, the challenge waiting for an answer, the salt handed out, expiry | a setup ceremony names its link; challenge and salt of their exact lengths; deleted when finished |
| `access_event` | kind, whose account, who acted, session, passkey, IP, device, small JSON detail | known kinds only; triggers `access_event_no_update` and `access_event_no_delete` |
| `rate_limit` | attempts per key and fixed window | windows long over are dropped on the next hit |

## Consistency

D1 has no interactive transactions; a batch is atomic. A use case queues its writes on a unit of work and `commit()`
sends them as one batch, so a capture is never stored without its note. Each feature declares what it writes
(`CaptureWrites`, `NoteWrites`) and `src/composition/unit-of-work.ts` puts them all on the same batch, so a write
can span features without either knowing the other's tables. Repositories only read.

Two people share the book, each maybe on two devices, so a change never overwrites one it has not seen (optimistic
concurrency). Every note on screen carries its version, and every change sends it back:

1. The use case reads the record and refuses with `*_changed_elsewhere` if the stored version is not the one shown.
2. Between that read and the write, the other person may save. The write sets the version to the one read plus one,
   and the trigger aborts the whole batch if the stored version has moved meanwhile.
3. The batch turns that abort into `StaleWriteError`, and `commitUnlessStale` into the same `*_changed_elsewhere`.

Either way the person sees one sentence and the page refreshes with the other change, so they decide again with the
newer words in front of them.

## Where feature 2 (parsing) attaches

- A new aggregate, `Interpretation`, in `src/features/capture/domain/` with its own table carrying `capture_id`,
  the model, the Zod-checked result and a confidence. What it derives gets a feature of its own: `orders/`,
  `reminders/`.
- Recording does not change: the capture is stored first, always. Parsing runs afterwards in `ctx.waitUntil` and
  writes the interpretation and what it derives - an order, a reminder - in one unit of work.
- A `CaptureReceived` domain event arrives then, when a capture has two things reacting to it. With one, an event
  would be indirection with nothing to show for it.
- Re-parsing runs a newer model over old captures and adds interpretations. Captures are not touched.
- Whether the note stays the entry shown, or becomes one view beside orders and reminders, is decided with
  feature 2, against what is actually typed.
