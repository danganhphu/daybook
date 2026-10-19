# Domain

The model behind the product, in the words the code uses. [design.md](design.md) says what the product does; this
file says how the data is shaped and which rules it keeps. A change to the data model is proposed here first.

## Words

| Term | She would say | Meaning |
|---|---|---|
| Capture | tin gõ vào | What she sent, exactly as sent, with where it came from and when. Never changes |
| Note | ghi chú | An entry in her list. Starts as a capture's words; she can edit, delete and restore it |
| Content | nội dung | Her text. Not blank, at most 4,000 characters, otherwise kept exactly as typed: spaces, line breaks, diacritics |
| Source | | Where a capture came in: `web` or `telegram` |
| Day | ngày | A calendar day in `Asia/Ho_Chi_Minh`. A day's notes are those created from its first instant up to the next day's |

Planned, not built:

| Term | Meaning |
|---|---|
| Interpretation | How a model read a capture: what it thinks she meant, which model, how sure. Many per capture - reading again with a better model adds one, never overwrites |
| Order, Customer, Reminder, Interaction | What an interpretation turns into. Each keeps the `capture_id` it came from |

## Why a capture and a note, not one row

Her words and the entry she works with obey different rules. As one row, editing an entry would destroy the only
record of what she sent, and re-reading old messages with a better parser - the reason `capture` exists, see
design.md "Dữ liệu" - would read her corrections instead of her words.

So the capture is the evidence and the note is the working copy. Today a note is a plain copy of the capture; once
parsing exists, the entries she sees are derived from captures the same way.

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

- `createdAt` never moves. It is the capture's `receivedAt`, so a note stays on the day she sent it.
- Every note points at its capture through `capture_id`, a foreign key.

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

Each feature's codes form one closed set - `NoteError` in `src/features/notes/application/note-errors.ts` - each
with the Vietnamese sentence she sees. "Can refuse" is an expected outcome, returned as a `Result`; a database that
is down is a fault and throws.

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

## Consistency

D1 has no interactive transactions; a batch is atomic. A use case queues its writes on a unit of work and `commit()`
sends them as one batch, so a capture is never stored without its note. Each feature declares what it writes
(`CaptureWrites`, `NoteWrites`) and `src/composition/unit-of-work.ts` puts them all on the same batch, so a write
can span features without either knowing the other's tables. Repositories only read.

There is no optimistic concurrency: two devices editing the same note at once means the last write wins. One user
on a phone and maybe a laptop makes that rare; a `version` column is the fix if it stops being rare.

## Where feature 2 (parsing) attaches

- A new aggregate, `Interpretation`, in `src/features/capture/domain/` with its own table carrying `capture_id`,
  the model, the Zod-checked result and a confidence. What it derives gets a feature of its own: `orders/`,
  `reminders/`.
- Recording does not change: the capture is stored first, always. Parsing runs afterwards in `ctx.waitUntil` and
  writes the interpretation and what it derives - an order, a reminder - in one unit of work.
- A `CaptureReceived` domain event arrives then, when a capture has two things reacting to it. With one, an event
  would be indirection with nothing to show for it.
- Re-parsing runs a newer model over old captures and adds interpretations. Captures are not touched.
- Whether the note stays the entry she sees, or becomes one view beside orders and reminders, is decided with
  feature 2, against what she actually types.
