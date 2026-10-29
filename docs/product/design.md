# daybook - product design

A notebook for a salesperson on the move: orders, customers and things to follow up, typed the way you would text a
friend. Two doors to one core: this web app, installable as a PWA, does everything on its own, and a Telegram bot is
an optional second way in for whoever lives in Telegram (see "Two equal doors" below).

Everything runs on Cloudflare's free plan: one Worker, D1, Workers AI. Technical rules are in `AGENTS.md`, the
interface in [the design system](../ui/design-system.md), the data model in [domain.md](../architecture/domain.md).

## The problem

Forgetting, not reporting. Notes get scattered and follow-ups slip. A dashboard does not cure that - it waits to be
opened. What cures it is the app speaking first, on the phone or in Telegram.

## The real competitor

The notes app already on the phone. It opens instantly, takes anything, needs no fields and no network. If daybook is
slower or asks for more taps, it loses. Every feature is weighed against that.

## Principles

One line: **type as if texting a person, not filling in a form for a machine.**

- **Free text is the main road.** Slash commands exist, as shortcuts.
- **Never refuse input.** What cannot be parsed is still saved, word for word, as a note. Losing someone's words is the
  worst thing this tool can do.
- **Save first, fix later.** No confirmation step - see below.
- **Undo is always there.** People type fast only when a mistake is cheap.
- **Nothing to set up first.** No product catalogue to fill in; products are learned as they are typed.
- **The app speaks first.**

## Two equal doors

The first design made Telegram the main way in and the web app the second. Reversed on 2026-10-26: she may prefer
the web app, the bot, or both, so **the web app does everything on its own** - add, edit and delete anything, orders,
customers, products, reports - and the bot is optional. Anything the bot can do, the web can do; nothing exists only
in the bot, and the app runs whole with no bot configured. The reasons for Telegram over Zalo still hold for the bot.

The web app is therefore built and shipped first, and the bot after real use shows whether she wants it. Speaking
first is not the bot's alone either: the morning list and the Friday summary go out through whichever channels each
person chooses - the installed app's notifications, or Telegram once linked.

## Decision: no confirmation per message

The first sketch showed a card with [Correct] [Edit] after every message, saving only on Correct. Rejected: fifteen
messages a day is fifteen taps that carry no information, the kind of friction that makes people quit. A wrong line
fixed later costs far less. So: save at once, show the result with Edit and Delete beside it, and ask only when truly
unsure - a name that matches two customers.

## Conversations

The bot and the app speak Vietnamese. The examples are the bot's; the web app's Hôm nay box takes the same words and
answers the same way, on the note.

Recording an order:

```
Người dùng:  bán 2 hộp thuốc tê cho chị Lan 500k

Bot:     Đã lưu đơn
         Nha khoa Lan Anh - Thuốc tê x2 - 500.000đ

         Đơn thứ 12 tháng này, tổng 8.450.000đ
         [Sửa]  [Xoá]
```

The running total confirms the numbers add up and shows progress. When unsure:

```
Bot:     Thuốc tê x2 - 500.000đ. Nhưng "chị Lan" là chỗ nào?
         [Nha khoa Lan Anh]  [Hương Lan]  [Thêm mới]
```

One box takes everything; the bot sorts it:

| Typed | Understood as |
|---|---|
| `bán 2 hộp thuốc tê cho chị Lan 500k` | an order |
| `nha khoa Minh Châu hẹn gọi lại thứ 5` | a reminder |
| `chị Hà hỏi giá, chưa trả lời` | a reminder |
| `nhớ mang catalogue` | a note |

What it cannot sort is kept as a note, with [Ghi thành đơn] [Đặt nhắc nhở] [Để vậy].

The app speaks first: a morning list (follow-ups due, and customers who went quiet that day) and a Friday summary
(orders, revenue, money in, what is owed, who has gone quiet), sent as notifications to every phone or browser where
the person turned them on - and to Telegram once the bot exists. Each person picks their own times in Settings, in
quarter hours, or turns either off; 07:30 and Friday 17:00 are guesses until she says otherwise. A morning with nothing
to say sends nothing, and a customer is named the day they go quiet rather than every morning after: a notification
that repeats itself is soon ignored. The "gone quiet" threshold is a guess too - three weeks to start - and a setting
of the book's, from 7 to 180 days: one number both people share, so a notification and Báo cáo always name the same
customers.

Changes to how someone signs in - a passkey added, a recovery link made, devices signed out - are told to that person
the same way, always: these cannot be turned off.

Notifications are offered where their value is plain: on Hôm nay, the first time something is due, once, and always in
Settings. Never on the first visit.

Every notification also stays behind a bell at the top of each tab, as apps do, with the number unread on it: a phone
that had push off, or a notification swiped away, loses nothing. Opening the list reads it. It keeps 30 days. Nhắc việc,
which the bell used to open, has its own checklist icon on Hôm nay.

Typing a customer's name shows their card: contact, last order, totals, notes.

## Slash commands

Telegram's menu lists the commands, which answers the empty chat box's question - "what can I type?".

| Command | Does |
|---|---|
| `/start` | a first greeting and example messages |
| `/today` | today's orders and follow-ups |
| `/week`, `/month` | the summaries |
| `/customer <name>` | a customer's card |
| `/reminders` | open follow-ups |
| `/edit` | edit the last entry |
| `/web` | a link to the web app |
| `/settings` | a link to the app's Settings, where the times and the "gone quiet" days are set |
| `/help` | examples |

Names are English: Telegram allows only Latin letters, digits and `_` in command names. Their menu descriptions are
Vietnamese. **Everything a command does can also be typed in plain words** - a command is never the only way.

## Data

Nothing in the model is tied to one trade; another business needs only different products.

| Table | Holds |
|---|---|
| `customer` | customers, with the other names people use for them |
| `product` | name, other names, latest price; created as typed, or added on its page |
| `order`, `order_line` | orders and their lines |
| `interaction` | calls, visits, messages |
| `reminder` | what, when, done |
| `capture` | **every message word for word**, never edited or deleted |
| `note` | an entry in the list, made from a capture; editable, deletable, restorable |
| `interpretation` | how a capture was read, by which model, and what came of it; reading again adds a row |

`capture` matters most. It keeps exactly what was typed, even when parsing fails, so odd numbers can be traced back and
a better parser can re-read everything. Everything derived from a message keeps its `capture_id`. Parse results live
apart from the capture so re-parsing never overwrites the original.

## Architecture

Two ways in, one core, one Worker:

```
  Telegram  --webhook--+
                       +--> core (parse, store, remind, sum up) --> D1
  PWA (web) -----------+         ^
  Cron (morning, Friday) --------+
```

**No logic in the bot or the web pages.** They take input, call the core, show the result, so a third entrance later
is a thin layer, not a rewrite.

**Cost: $0, no card.** AWS, Azure and Google Cloud all want a card and none stops at zero; Cloudflare refuses requests
over a limit instead of billing. The price: Workers cannot run .NET, the first plan, so this is TypeScript.

## The web app

Everything, on its own (see "Two equal doors"):

- the same chat box as the bot: today to write in, earlier days to read and correct, and a search over every note
  that does not care about diacritics
- orders by month, filtered; each order's delivery, payments and history
- a page per customer, and per product ("sản phẩm" - the trade's word, not "món"), each with the other names it is
  known by
- reminders, open and finished, each one tap from done or open again
- numbers for any period, with charts
- what was deleted in the last thirty days, after the Undo toast is gone, to restore
- two customers, or two products, that turn out to be one: merged, with what moves said first, since a merge has no
  Undo. The merged one's name becomes the kept one's other name, so a message calling it by that name is understood
- notifications: the morning list, the Friday summary and sign-in notices, on every browser where they are turned on

Installed to the home screen as a PWA; no app store. On Android, Chrome shows notifications whether or not the app is
installed; an iPhone needs the app on its home screen (iOS 16.4 or later).

## Sign-in

Two people share one book: both see and edit the same data, and each message records who typed it. No roles. Nobody
signs up: the first account comes from the command line, the second by invitation from inside the app.

Signing in is a button and Face ID or a fingerprint - a **passkey**. Nothing to remember, no third-party account, and
a fake page cannot use it because a passkey is bound to the site.

- **A password is the fallback**, at least 15 characters (NIST SP 800-63B-4). A Worker on the free plan cannot hash
  passwords to OWASP's standard (PBKDF2 capped at 100,000 iterations, 10 ms of CPU), so the browser runs Argon2id and
  the server keeps an HMAC of the result.
- **A sign-in lasts 30 days** from the moment it happened, however often the app is used (NIST AAL1), and ends sooner
  if the app goes unopened for 14 days (ASVS 7.3.1) - two weeks off cost one Face ID. Opening the app goes straight
  in; security settings - passkeys, the password, other devices, invites - ask for Face ID again, or the password on
  an account that has no passkey. A password alone opens the book but never its security settings, so someone who
  phished it cannot add their own passkey.
- **Invites and recovery links** work once, for ten minutes. Whoever loses every way in gets a recovery link from the
  other user, in the app; so does someone on a new phone whose passkey did not sync. Either user can sign out every
  device of the other - a phone lost on the road. The command line is for the first account and for when both are
  locked out.
- The bot knows the two people by their Telegram user ids; there is no sign-in in the chat.

Rejected: hosted sign-in services (Supabase pauses free projects after a week idle, Auth0 deletes idle free tenants
after 150 days, Clerk's free plan has no passkeys), Cloudflare Access (needs a card), and signing in with Telegram or
Google (a plain sign-in screen was wanted).

## First release

1. Telegram takes any message, an LLM parses it, it is saved at once, the result card has Edit and Delete
2. Look-up by typing a customer's name
3. The bot speaks first: mornings and Friday afternoons
4. Web: the chat box, an editable order table, a page of numbers
5. The slash commands above

Deferred, with reasons:

| Deferred | Why |
|---|---|
| Google Drive | OAuth, expiring tokens, permissions - for what would only be a copy of the database |
| Excel / Word export | nothing needs a file yet; readable numbers are enough |
| Roles, several books | two people who trust each other share one book |
| A native app | the PWA is enough, with no store review |

## Unknowns

- How often a customer should be contacted before they count as "gone quiet"
- What people actually type into their notes app today - the most valuable question, answered only by real use
