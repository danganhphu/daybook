# Domain

The model behind the product, in the words the code uses. [design.md](design.md) says what the product does; this
file says how the data is shaped and which rules it keeps. A change to the data model is proposed here first.

## Words

| Term | In the app | Meaning |
|---|---|---|
| Capture | tin gõ vào | What was sent, exactly as sent, with where it came from and when. Never changes |
| Note | ghi chú | An entry in the list. Starts as a capture's words; it can be edited, deleted and restored |
| Content | nội dung | The user's text. Not blank, at most 4,000 characters, otherwise kept exactly as typed: spaces, line breaks, diacritics |
| Source | | Where a capture came in: `web` or `telegram` |
| Day | ngày | A calendar day in `Asia/Ho_Chi_Minh`. A day's notes are those created from its first instant up to the next day's |
| Account | tài khoản | One of the two people using the book. A lower-case username for the fallback password, a display name, a random WebAuthn user handle |
| Passkey | khoá đăng nhập, Face ID | The way in: a WebAuthn credential bound to this app's host |
| Session | thiết bị đã đăng nhập | One signed-in browser. Lives 30 days from the sign-in that opened it |
| Setup link | link cài đặt | A one-time, ten-minute link: the first setup (from the command line), an invite, or a recovery for someone who lost every way in |
| Ceremony | | A sign-in step a browser is part-way through, tied to that browser |
| Step-up | xác nhận lại | A sign-in in the last five minutes, which security settings ask for |
| Access event | hoạt động đăng nhập | A record of who signed in, what changed, and from where. Never edited |

Planned, not built:

| Term | Meaning |
|---|---|
| Interpretation | How a model read a capture: what it thinks was meant, which model, how sure. Many per capture - reading again with a better model adds one, never overwrites |
| Order, Customer, Reminder, Interaction | What an interpretation turns into. Each keeps the `capture_id` it came from |

## Why a capture and a note, not one row

The words and the entry worked with obey different rules. As one row, editing an entry would destroy the only
record of what was sent, and re-reading old messages with a better parser - the reason `capture` exists, see
design.md "Data" - would read the corrections instead of the words.

So the capture is the evidence and the note is the working copy. Today a note is a plain copy of the capture; once
parsing exists, the entries shown are derived from captures the same way.

## Capture

- Made by `receive(content, source, receivedAt)` in `src/features/capture/domain/capture.ts`. There is no other
  operation.
- Never updated, never deleted. The type is readonly and has no function that changes it; in the database, two
  triggers abort any `UPDATE` or `DELETE` on `capture`, so a hand-written query cannot break the rule either.
- `source` is a known value and `content` is not blank, checked by the type and again by `CHECK` constraints.

## Note

A note is either live or deleted: `LiveNote | DeletedNote`, discriminated by `status`. A function that needs a live
note says so in its type. The transitions are pure functions in `src/features/notes/domain/note.ts`:

| Function | From | Gives |
|---|---|---|
| `fromCapture` | a capture | a live note with the capture's words, created and updated at the capture's time |
| `edit` | live | live, with the new content and `updatedAt` moved |
| `edit` | deleted | `note_deleted` |
| `markDeleted` | live | deleted, with `deletedAt` |
| `markDeleted` | deleted | the same note, unchanged: deleting is undoable, so deleting twice is harmless |
| `restore` | deleted | live, exactly as it was before the delete |
| `restore` | live | `note_not_deleted` |

- `createdAt` never moves. It is the capture's `receivedAt`, so a note stays on the day it was sent.
- Every note points at its capture through `capture_id`, a foreign key.

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
- **Every attempt is counted and recorded.** Redeeming a link is limited to 10 tries per client in 10 minutes, a client
  being an IPv4 address or an IPv6 /64. Successes, refusals and limits all land in `access_event`.

## Use cases

One file each in the feature's `application/` folder (`src/features/capture/`, `src/features/notes/`), reached
through `createApp` in `src/composition/create-app.ts`.

| Use case | Does | Can refuse with |
|---|---|---|
| `recordCapture` | Stores the capture and its note together | - |
| `editNote` | Replaces a live note's content | `note_not_found`, `note_deleted` |
| `deleteNote` | Soft-deletes a note | `note_not_found` |
| `restoreNote` | Brings a deleted note back | `note_not_found`, `note_not_deleted` |
| `listNotesForDay` | A day's live notes, newest first | - |
| `authenticate` | The session behind a cookie; records its use at most hourly | `unauthenticated` |
| `redeemSetupLink` | Spends a setup link and starts a setup ceremony bound to this browser | `setup_link_unusable`, `rate_limited` |
| `signOut` | Ends this session | - |
| `endOtherSessions` | Ends every other session of the account | `step_up_required` |
| `listSessions` | The account's sessions, most recently used first | - |
| `issueSetupLink` | A setup link and its token, shown once. Reached from the command line today, from Settings later | - |

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
| `received_at` | integer | epoch milliseconds |

Triggers `capture_no_update` and `capture_no_delete` abort with "capture is append-only".

`note`, `STRICT`:

| Column | Type | Rule |
|---|---|---|
| `id` | text | primary key, UUIDv7 |
| `capture_id` | text | foreign key to `capture.id` |
| `content` | text | not blank |
| `created_at`, `updated_at` | integer | epoch milliseconds |
| `deleted_at` | integer | null while live |

Indexes: `note_live_by_created_at` on `created_at`, partial on `deleted_at is null`, serves the day list;
`note_by_capture` serves tracing a capture to its notes.

The access tables, all `STRICT`, ids UUIDv7, times epoch milliseconds, secrets as the base64url of their SHA-256:

| Table | Holds | Rules the database keeps |
|---|---|---|
| `account` | username, display name, WebAuthn user handle | username unique, lower-case `a-z0-9._-`, 3-32 long |
| `passkey` | a credential's id, public key, algorithm, counter, transports, backup flags | algorithm one of those offered; filled from step 2 of the sign-in plan |
| `session` | the verifier, how it signed in, when it started, ends and was last seen, the device label | a password session names no passkey; it ends after it starts |
| `setup_link` | purpose, account, author, token hash, expiry, redemption | an unredeemed invite names no account; a first-setup link has no author; trigger `setup_link_redeemed_once` |
| `ceremony` | kind, browser binding, account, setup link, expiry | a setup ceremony names its link; deleted when used |
| `access_event` | kind, whose account, who acted, session, passkey, IP, device, small JSON detail | known kinds only; triggers `access_event_no_update` and `access_event_no_delete` |
| `rate_limit` | attempts per key and fixed window | windows long over are dropped on the next hit |

## Consistency

D1 has no interactive transactions; a batch is atomic. A use case queues its writes on a unit of work and `commit()`
sends them as one batch, so a capture is never stored without its note. Each feature declares what it writes
(`CaptureWrites`, `NoteWrites`) and `src/composition/unit-of-work.ts` puts them all on the same batch, so a write
can span features without either knowing the other's tables. Repositories only read.

There is no optimistic concurrency: two devices editing the same note at once means the last write wins. Two people
on their phones and maybe a laptop make that rare; a `version` column is the fix if it stops being rare.

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
