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
| Session | thiết bị đã đăng nhập | One signed-in browser. Lives 30 days from the sign-in that opened it, or until 14 days unused |
| Setup link | link cài đặt | A one-time, ten-minute link: the first setup (from the command line), an invite, or a recovery for someone who lost every way in |
| Ceremony | | A sign-in step a browser is part-way through, tied to that browser |
| Step-up | xác nhận lại | A sign-in in the last five minutes, which security settings ask for |
| Fallback password | mật khẩu dự phòng | For a browser without passkeys. Optional; never sent, only a key derived from it |
| Invite | link mời | A setup link for someone new, made by a signed-in user; the newcomer names the account |
| Recovery link | link khôi phục | A setup link for the other user's account, when they lost every way in |
| Access event | hoạt động đăng nhập | A record of who signed in, what changed, and from where. Never edited |

| Customer kind | loại khách | The owner's own grouping of customers, typed into Settings. The code names none of them |
| Customer | khách | Someone orders are for: a name, and optionally a kind, an area, a phone, an address, a note. Hidden, never deleted |
| Product | sản phẩm | Something sold, made the first time an order names it, or added on the products screen. "Thuốc tê" and "thuoc te" are one product. Never "món", which reads as food |
| Other name | tên khác | Another name a customer or a product is known by: "chị Lan" for Nha khoa Lan Anh. Matched as the name is |
| Merge | gộp | Two customers, or two products, that are one: everything of one moves to the other, which keeps its names as other names. Recorded; no Undo |
| Order | đơn | A customer's order on a day: its lines, its delivery day, its payments. Its total is the sum of its lines |
| Payment | lần thu | Money taken for an order, on a day, by cash or transfer. Never edited: removed with who and when |
| Owed | còn nợ | An order's total less its live payments, never below zero; a customer owes the sum over their live orders |
| Order change | lịch sử | One entry of an order's log: who, when, what kind, and the order before and after |
| Reminder | việc cần nhắc | Something to do on a day, for a customer or not. Done with who and when; deleted with Undo. Made from a note, it keeps that note's capture |
| Due | đến hạn | A reminder still open whose day is today or earlier |
| Reading | đọc tin | What a message says, in its own words: an order, a reminder or a note, the customer as written, each line's product, quantity and price as written, the day it names |
| Interpretation | | One reading of a capture: by which model and prompt, or by a person answering, what came of it, and what it cost. Never changed; reading again adds one |

Planned, not built:

| Term | Meaning |
|---|---|
| Interaction | What a reading turns into, beside orders and reminders: a visit, a call. Keeps the `capture_id` it came from |

## Why a capture and a note, not one row

The words and the entry worked with obey different rules. As one row, editing an entry would destroy the only
record of what was sent, and re-reading old messages with a better parser - the reason `capture` exists, see
design.md "Data" - would read the corrections instead of the words.

So the capture is the evidence and the note is the working copy. The note stays the entry shown; what a reading of
its capture made - an order, a reminder - shows beneath it.

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

## Products

`src/features/products/`. A product is hidden (`archived_at`), never deleted: old orders still show what they sold.

- **One name, one product.** A name - a product's own or one of its other names - means one shown product, ignoring
  case and diacritics. Adding or renaming onto a name that already means another shown product is refused
  (`product_name_taken`); so is another name a shown product answers to, or any product's other name
  (`alias_taken`), hidden ones' included, whose search names the database keeps unique.
- **An order line names a product by any of its names** (`findActiveNamed`), the form's and a reading's alike; only a
  name that means nothing makes a new product.
- **A hidden product** leaves the suggestions and stays on old orders; shown again only if its name is still free.
- **Other names** belong to the customer or product; nothing points at one, so removing it deletes the row. A
  customer's other names are unique within that customer only: two customers may share a name.

## Merging

`src/features/merging/`. Two customers, or two products, that turned out to be one.

- **Everything moves to the one kept, in one batch.** A customer merge moves every order and reminder of the merged
  one, deleted and done ones too, so restoring one later finds the kept customer; a product merge rewrites every line
  that sold the merged product, at its own quantity and price. Each order moves through its own domain function
  (`reassignCustomer`, `replaceProduct`), with its version and a `customer_merged` or `product_merged` log entry.
- **The merged one is hidden for good**, naming the one kept (`merged_into_id`); it cannot be shown again, nor merged
  again. A hidden one can be merged, which is how a duplicate hidden earlier joins the real one.
- **Its names follow**: its name and its other names become the kept one's other names, unless the kept one already
  answers to them, so a message that calls it "chị Lan" is matched next time.
- **Both records are checked first.** The batch starts by writing the merged record and the kept one, each with its
  version, so a change to either from another screen aborts the whole merge (`*_changed_elsewhere`); an order changed
  meanwhile aborts it too, by its own version.
- **No Undo, so the screen asks first**, saying how many orders and reminders will move. The merge is recorded
  (`customer_merge`, `product_merge`: which two, who, when, the ids moved), append-only.

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
- **Products come from the order form**, or the products screen. A line names a known product by id or a new one by
  name; a name matching a shown product's name or one of its other names, ignoring case and diacritics, is that
  product. New ones are written in the order's batch.
- **A product's last price is read, not stored**: the latest live line, this customer's first.
- **Every change is logged** (`order_change`, ADR 0011 decision 10): `placed`, `revised`, `delivered`, `undelivered`,
  `payment_added`, `payment_removed`, `deleted`, `restored`, with the order before and after as JSON. `OrderWrites`
  takes the entry with every write, so no change is stored without it. The page reads the log in words
  (`history-text.ts`).
- **A form-made order has no `capture_id`**; it is set when a message became the order (decision 5).

## Reminders

`src/features/reminders/`. A reminder's text is the same `Content` as a note's, so a note's words always fit. Done
and deleted are independent states, so each Undo is one update.

| Function | Refuses with |
|---|---|
| `revise` | `reminder_deleted` |
| `complete`, `reopen` | `reminder_deleted`; `reminder_done` (complete), `reminder_open` (reopen) |
| `markDeleted`, `restore` | `reminder_not_deleted` (restore); deleting twice returns it as it is |

- **Open** means live and not done. Lists come soonest due first, so an overdue one never drops out of sight.
- **A new customer must be shown**, not hidden; the one a reminder already has may stay.
- **Made from a live note**, it keeps the note's `capture_id`; from the form, it has none (decision 5).
- **Who finished it** is kept beside when (`done_by`, approved 2026-10-23): `updated_by` changes with the next edit.

## Reading

`src/features/reading/`, ADR 0012. A note is read once it is saved, in a request of its own, so saving never waits for
a model. What is read is the capture - the words as sent - as of the Vietnam day it was sent, not the note's
current words.

- **The model extracts, the code decides.** The model (`MessageReader`) returns a `Reading`, checked by the same Zod
  schema it was asked to follow. The code matches the customer and the products, turns "500k", "1tr2" and "2 củ" into
  money (`money-words.ts`), and checks the day.
- **A customer is matched by the words of their name or of another name they are known by**, without the titles
  written before it - "chị", "anh", "nk", "nha khoa" (`customer-words.ts`) - with or without accents. A name that is
  exactly one active customer's is them; otherwise one customer holding every word is them; none or several, and an
  order waits for a person. Products are matched by any of their names the same way.
- **An amount is a line's total** unless the message says it is for one unit, or the product's last price is nearer
  the amount than the amount split per unit (`line-price.ts`). A line without an amount takes its last price, or 0
  until someone fills it in. A line without a quantity is one.
- **An order is placed through the order's own checks** (`prepareOrder`), on the day the message was sent, with its
  `capture_id`, in the same batch as the interpretation. Refused - a product name too long, say - nothing is made and
  the interpretation is `failed` with `refused`.
- **A reminder is not asked about**: its customer is set only when the name is plainly one; it is due on the day the
  reading names, or the day the message was sent when that is all it says or the named day is past or not real. Its
  text is the message.
- **Unsure** means an order whose customer matched nobody (`unknown`) or several (`ambiguous`, up to four offered).
  Nothing is made until a person answers: a customer, a new customer named as written (added only with the order),
  or "not an order". The answer is an interpretation of its own, by `person`, read from the words kept; the model is
  not asked again.
- **Read once.** A message is read again only after a failed reading, and answered only while unsure. Something made
  from it, by a reading or by hand from the note, settles it too. Two requests at once cannot both make an order: the
  database refuses an interpretation after a settled one, the batch reports it stale, and the second request answers
  "already read".
- **Failures are readings too**: `schema` (the answer broke the schema, on both models), `quota` (the day's 10,000
  free Neurons are spent; they come back at 07:00 in Vietnam), `timeout`, `error`, `refused`. The note stays a note
  and says so.
- **What a note shows** (`readingStates`): what was made, live, before anything else; then the latest reading if it
  is unsure or failed; `unread` for a message never read, which the note's menu offers to read.

## Reports

`src/features/reports/`. Reads only: it owns no table and changes nothing. The numbers mean what sales reports
usually mean, each on its own basis:

- **Doanh số** (sales): the lines of live orders placed in the period, by the day each was placed. Summed over lines,
  so a report narrowed to one product counts that product's lines, not whole orders.
- **Thu về** (money in): live payments made in the period, by payment day, whatever day their orders were placed.
- **Khách còn nợ** (owed): what every live order placed by the period's end still owed at that end - or today, while
  the period runs - each order at least zero.

The two money figures have different bases, so they are never drawn as parts of one whole. A payment pays an order,
not a product, so under a product filter they are not told; the units sold are, instead.

- **A period** is a week from Monday, a month, a quarter, a year, or a range of days up to two years
  (`report-period.ts`). A calendar period moves by whole periods; a range moves by its own length. Its sales are
  compared with the period before of the same kind.
- **A chart's columns** are days (a week, a month, a range of up to 31 days), weeks from Monday (a quarter, a range of
  up to 92 days) or months. Every column of the period is there; a day without sales is zero.
- **A customer has gone quiet** when their last live order is 21 days old or more (`gone-quiet.ts`), and they are not
  hidden. A constant for now, not a setting.
- **Breakdowns** - by kind, the top five products and customers, the quiet ones - leave out what the report is
  filtered to: no breakdown by kind under a kind or customer filter, no top customers for one customer.

## Access

Two people share one book; `src/features/access/` decides who is signing in. The decisions and their sources are in
design.md, "Sign-in". The rules the code keeps:

- **No secret is stored as itself.** A session cookie is `<session id>.<secret>`; a setup link carries a token in its
  URL fragment; a ceremony is tied to a browser by a cookie. Each secret is 256 random bits, and only its SHA-256 is
  kept, compared in constant time. A fast hash is enough for random secrets of that size.
- **A session exists only because someone authenticated.** `enlistNewSession` is called by the use cases that
  authenticate, never by an adapter, and it queues the session on their unit of work: a sign-in commits whole or not at
  all. Every sign-in gets a new session id; the browser's previous session ends in the same commit.
- **A session ends 30 days after its sign-in**, however often it is used, **or after 14 days unused**, whichever
  comes first. `lastSeenAt` moves at most hourly and feeds the device list and the idle limit; a session that ran out
  is no longer listed.
- **A setup link works once and for ten minutes.** Used, expired and unknown links get the same answer, so a link
  reveals nothing. The database refuses a second redemption too, in case two arrive at once.
- **What a link carries depends on its purpose**: an invite names no account until it is redeemed; a first-setup link
  has no author, since only the command line issues one.
- **A passkey is discoverable and user-verified**, signed for this app's origin and RP ID, with no attestation asked
  for, with ES256 or Ed25519 (RS256 is refused: ASVS 5.0 disallows RSASSA-PKCS1-v1_5). The person never types a
  username to use one: the passkey says whose it is.
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
  failures in a row lock the password, counted in one statement so guesses sent together all count; passkeys keep
  working. Sign-in is limited per client (20 in 10 minutes) and per username (10 in 15 minutes), the username keyed
  with the pepper so what was typed is not kept. A new password that is little more than the app's name, the trade or
  the username is refused in the browser.
- **Security settings need a recent sign-in** (step-up, five minutes): adding or removing a passkey, setting the
  password, changing the username, ending sessions, invites and recovery links. Confirming is a passkey sign-in scoped
  to the account, or the password for an account with no passkey; either opens a fresh session in place of the old.
  On an account with a passkey, a password sign-in opens the book but never counts as a step-up. The server decides;
  the page only asks when told.
- **The last way in stays.** A passkey can be removed only while another passkey or an unlocked password remains.
  Removing one signs out the other devices it signed in; after a removal or a password change, the page offers to
  sign out every other device.
- **Either user can sign out every device of the other**, after step-up - a phone lost on the road. The other's
  passkeys stay; they remove the lost one themselves, after a recovery link if need be.
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
| `archiveCustomer`, `restoreCustomer` | Hides a customer from the lists; shows them again, unless merged | `customer_archived`, `customer_not_archived`, `customer_merged` |
| `listCustomers` | By name, filtered by words (of the name or of another name), kind and shown or hidden; 200 at most | - |
| `addCustomerAlias`, `removeCustomerAlias` | Another name for a shown customer; removes one | `customer_not_found`, `customer_archived`, `alias_taken`, `alias_not_found` |
| `listProducts`, `productUsage` | By name, filtered by words and shown or hidden, 200 at most; each product's live orders and latest price | - |
| `addProduct`, `renameProduct` | A product before any order names it; a new name | `product_name_taken`, `product_not_found`, `product_changed_elsewhere` |
| `archiveProduct`, `restoreProduct` | Hides a product from the suggestions; shows it again if its name is free and it was not merged | `product_archived`, `product_not_archived`, `product_merged`, `product_name_taken` |
| `addProductAlias`, `removeProductAlias` | Another name for a shown product; removes one | `product_not_found`, `product_archived`, `alias_taken`, `alias_not_found` |
| `mergeCustomers`, `mergeProducts` | Everything of one moved to the other, the one hidden for good, its names kept, recorded; one batch | `merge_into_itself`, `*_not_found`, `*_changed_elsewhere`, `*_merged`, `*_kept_unavailable` |
| `customerMergePreview`, `productMergePreview` | How many live orders and reminders a merge would move | - |
| `placeOrder`, `reviseOrder` | An order, making the products it names first | `customer_unavailable`, `product_not_found`, the order's own refusals |
| `deliverOrder`, `undeliverOrder`, `addPayment`, `removePayment` | One change, logged | `order_not_found`, `order_changed_elsewhere`, the order's own refusals |
| `deleteOrder`, `restoreOrder` | Soft delete with Undo; deleting twice writes nothing | `order_not_found`, `order_changed_elsewhere` |
| `addReminder` | A reminder, from the form or from a live note | `customer_unavailable`, `note_unavailable` |
| `reviseReminder` | New words, day or customer | `reminder_not_found`, `reminder_changed_elsewhere`, `reminder_deleted`, `customer_unavailable` |
| `completeReminder`, `reopenReminder` | Done, by whom and when; open again | `reminder_not_found`, `reminder_changed_elsewhere`, `reminder_deleted`, `reminder_done`, `reminder_open` |
| `deleteReminder`, `restoreReminder` | Soft delete with Undo; deleting twice writes nothing | `reminder_not_found`, `reminder_changed_elsewhere`, `reminder_not_deleted` |
| `listDoneReminders` | Finished ones, latest first, a page after a cursor of (done at, id) rather than an offset, so a reminder reopened between pages shifts nothing | - |
| `listDeletedNotes`, `listDeletedOrders`, `listDeletedReminders` | Deleted since a moment (the screen asks for 30 days), latest first, 50 at most | - |
| `readNote` | Reads a note's message and makes the order or reminder it describes, or asks, or keeps the failure | `note_unavailable`, `reader_unavailable`, `already_read` |
| `answerReading` | Settles an unsure reading with a customer, a new customer, or as a note | `note_unavailable`, `not_asked`, `customer_unavailable`, `customer_unnamed` |
| `readingStates` | What each of a day's notes shows about its message, in four queries | - |
| `readReport` | A period's figures, narrowed by kind, customer or product: sales against the period before, money in, owed, sales over time, by kind, top products and customers, quiet customers | - |
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
| `endPersonSessions` | Ends every session of the other account, its passkeys left alone | `step_up_required`, `not_found` |
| `listSessions` | The account's sessions still running, most recently used first | - |
| `accountOverview` | Everything Settings shows: account, passkeys, password status, sessions, activity, people | - |
| `changeDisplayName` | Renames the account | - |
| `changeUsername` | Changes the username | `step_up_required`, `username_taken` |
| `beginPasswordChange` | A new salt for a new fallback password | `step_up_required` |
| `finishPasswordChange` | Stores the verifier of the new password, unlocked | `step_up_required`, `password_not_saved` |
| `startAddingPasskey` | A creation prompt for another passkey, excluding those the account has | `step_up_required` |
| `finishAddingPasskey` | Stores it | `step_up_required`, `passkey_not_accepted` |
| `removePasskey` | Removes one, never the last way in, and ends the other sessions it opened | `step_up_required`, `not_found`, `last_way_in` |
| `issueSetupLink` | A setup link and its token, shown once; the command line's first setup and break-glass | - |
| `issueInvite` | An invite from a signed-in user | `step_up_required` |
| `issueRecoveryLink` | A recovery link for the other account | `step_up_required`, `not_found` |
| `nameInvitedAccount` | Makes the invited account from the newcomer's name and username | `setup_link_unusable`, `username_taken` |
| `resumeSetup` | Where a setup stands, from its ceremony cookie, after a reload | `setup_link_unusable` |

Reads for screens - an order list, its totals, what each customer owes, a customer's account, last prices, an
order's log - are SQL in `order-queries.ts`, one or two statements a screen, inside D1's 50 queries per request on
the free plan. Open reminders are one indexed read (`reminder_open_by_due_on`), with one more for the customers'
names. A report is nine aggregate statements run together (`report-queries.ts`), plus the kinds and the names of
what it is filtered to.

Each feature's codes form one closed set - `NoteError` in `src/features/notes/application/note-errors.ts`,
`AccessError` in `src/features/access/application/access-errors.ts`, `ReadingError` in
`src/features/reading/application/reading-errors.ts` - each with the Vietnamese sentence the user sees. "Can refuse" is an expected outcome, returned as a `Result`; a database that is down is a fault and throws.

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
| `customer` | name, search name, kind, area, phone, address, note, merged into | lengths; optional details null, never ""; triggers `customer_merged_only_hidden_on_insert` and `_on_update`: merged into another only while hidden, never itself |
| `customer_alias` | customer, name, search name, who and when | no audit: removed outright; unique (customer, search name) |
| `product` | name, search name, merged into | shown names unique by search name; triggers `product_merged_only_hidden_on_insert` and `_on_update` |
| `product_alias` | product, name, search name, who and when | no audit: removed outright; search name unique across all |
| `customer_merge`, `product_merge` | from, into, the ids moved as JSON, who and when | not itself; valid JSON; append-only triggers `*_merge_no_update`, `*_merge_no_delete` |
| `sales_order` | customer, ordered on, delivered on, note, capture | days are `YYYY-MM-DD`; delivered on or after ordered |
| `order_line` | order, position, product, quantity, unit price | quantity 1-100,000; price 0 to a trillion; no audit, replaced whole on a revision |
| `payment` | order, amount, paid on, method, note, who and when recorded, removal | amount 1 to a trillion; method `cash`, `transfer` or none; trigger `payment_only_removal`, `payment_no_delete` |
| `order_change` | order, kind, who and when, before and after as JSON | known kinds, `customer_merged` and `product_merged` among them; valid JSON; triggers `order_change_no_update`, `order_change_no_delete` |
| `reminder` | text, due on, customer, capture, done at and by | text not blank, at most 4,000; due on `YYYY-MM-DD`; done at and by both or neither |
| `interpretation` | capture, model, prompt version, outcome, result as JSON, failure, Neurons, who and when | no audit: never changed; known outcomes and failures; a result exactly when not failed, valid JSON; triggers `interpretation_no_update`, `interpretation_no_delete`, and `interpretation_once_settled`, which refuses a row after an `order`, `reminder` or `note` one of the same capture with `stale_version` |

The access tables, all `STRICT`, ids UUIDv7, times epoch milliseconds, secrets as the base64url of their SHA-256.
Every number a `CHECK` holds - lengths, the Argon2id floor, the algorithms - is the domain's own constant, written
into the statement by `src/shared/infrastructure/d1/sql-literals.ts`, so the two cannot drift:

| Table | Holds | Rules the database keeps |
|---|---|---|
| `account` | username, display name, WebAuthn user handle | username unique, lower-case `a-z0-9._-`, 3-32 long |
| `passkey` | a credential's id, public key, algorithm, counter, transports, backup flags, name, last use | credential id unique; algorithm ES256 or Ed25519 |
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

## How reading attaches

- Recording does not change: the capture and its note are stored first, always. The page then asks for the note to
  be read, and the bot will do the same after it answers. Reading writes the interpretation and what it made in one
  unit of work.
- A `CaptureReceived` domain event arrives when a capture has two things reacting to it. With one, an event would be
  indirection with nothing to show for it.
- Re-reading old captures with a newer model or prompt adds interpretations; the model and prompt version on each
  row let the two be compared on the same messages first. Captures are not touched.
- The note stays the entry shown, with what was made beneath it.
