import type { InlineKeyboardButton } from "@grammyjs/types";
import type { Temporal } from "temporal-polyfill/implementation";

import type { ActiveCustomer } from "@/features/customers/domain/customer";
import type { Note } from "@/features/notes/domain/note";
import { notesCopy } from "@/features/notes/web/notes-copy";
import type { OrderMadeFrom, OrderTotals } from "@/features/orders/application/order-queries";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import type { CustomerQuestion, ReadFailure } from "@/features/reading/domain/interpretation";
import {
  addCustomerNamed,
  readingCopy,
  unknownCustomer,
} from "@/features/reading/web/reading-copy";
import { dueWords, failureText, orderSummary } from "@/features/reading/web/reading-text";
import type { LiveReminder } from "@/features/reminders/domain/reminder";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import type { Version } from "@/shared/domain/audit";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { actionLabels } from "@/shared/ui/action-labels";
import { moneyText } from "@/shared/web/money-text";
import { deleteQuestion } from "@/shared/web/recently-deleted";
import { dayPath, orderPath, routes } from "@/shared/web/routes";

import { botCopy, orderOfMonth } from "./bot-copy";
import { customerTail, type CallbackAction } from "./callback-data";
import { escapeHtml } from "./html";
import { rows, tap, urlButton } from "./keyboard";

// A message the bot sends or edits: HTML text, every word from the book escaped, and its buttons in rows
export type Card = {
  readonly text: string;
  readonly keyboard: ReadonlyArray<ReadonlyArray<InlineKeyboardButton>>;
};

export type CardContext = {
  readonly appOrigin: URL;
  readonly today: Temporal.PlainDate;
};

// What came of a message, as its card shows it
export type MessageOutcome =
  | {
      readonly kind: "order";
      readonly order: OrderMadeFrom;
      readonly version: Version;
      // The month's live orders, this one among them
      readonly month: OrderTotals;
    }
  | { readonly kind: "reminder"; readonly reminder: LiveReminder }
  | {
      readonly kind: "unsure";
      readonly question: CustomerQuestion;
      readonly written: string | undefined;
      readonly candidates: ReadonlyArray<ActiveCustomer>;
    }
  | { readonly kind: "failed"; readonly failure: ReadFailure; readonly canReadAgain: boolean }
  // Kept as a note: read as one, or not read at all where no model is bound
  | { readonly kind: "saved" };

// Bot API, InlineKeyboardMarkup: a few buttons a row read best on a phone
const answersPerRow = 2;

// The web's page for the day a note was written, where it can be changed
function notePath(note: Note, context: CardContext): string {
  const day = vietnamDate(note.audit.createdAt).toString();

  return dayPath(day, context.today.toString());
}

function orderCard(
  outcome: Extract<MessageOutcome, { kind: "order" }>,
  context: CardContext,
): Card {
  const { order, month } = outcome;

  return {
    text: [
      `<b>${readingCopy.orderMade}</b>`,
      escapeHtml(orderSummary(order)),
      orderOfMonth(month.count, moneyText(month.total)),
    ].join("\n"),
    keyboard: [
      [
        tap(actionLabels.undo, { kind: "undo_order", id: order.orderId, version: outcome.version }),
        urlButton(botCopy.openOrder, orderPath(order.orderId), context),
      ],
    ],
  };
}

function reminderCard(reminder: LiveReminder, context: CardContext): Card {
  return {
    text: `<b>${readingCopy.reminderMade}</b>: ${escapeHtml(dueWords(reminder, context.today))}`,
    keyboard: [
      [
        tap(actionLabels.undo, {
          kind: "undo_reminder",
          id: reminder.id,
          version: reminder.audit.version,
        }),
        urlButton(botCopy.open, routes.reminders, context),
      ],
    ],
  };
}

function unsureCard(
  note: Note,
  outcome: Extract<MessageOutcome, { kind: "unsure" }>,
  context: CardContext,
): Card {
  const { written, candidates } = outcome;
  const question =
    outcome.question === "ambiguous"
      ? readingCopy.whose
      : written === undefined
        ? readingCopy.noCustomer
        : unknownCustomer(written);
  const picks = candidates.map((customer, candidate) =>
    tap(customer.area === undefined ? customer.name : `${customer.name}, ${customer.area}`, {
      kind: "answer_customer",
      id: note.id,
      candidate,
      customerTail: customerTail(customer.id),
    }),
  );

  return {
    text: escapeHtml(question),
    keyboard: [
      ...rows(picks, answersPerRow),
      ...(written === undefined
        ? []
        : [[tap(addCustomerNamed(written), { kind: "answer_new_customer", id: note.id })]]),
      [
        urlButton(readingCopy.pickCustomer, notePath(note, context), context),
        tap(readingCopy.notAnOrder, { kind: "answer_not_order", id: note.id }),
      ],
    ],
  };
}

function savedCard(note: Note): Card {
  return {
    text: botCopy.saved,
    keyboard: [
      [
        tap(actionLabels.remove, {
          kind: "ask_delete_note",
          id: note.id,
          version: note.audit.version,
        }),
      ],
    ],
  };
}

// The answer to one message, once read
export function messageCard(note: Note, outcome: MessageOutcome, context: CardContext): Card {
  switch (outcome.kind) {
    case "order":
      return orderCard(outcome, context);
    case "reminder":
      return reminderCard(outcome.reminder, context);
    case "unsure":
      return unsureCard(note, outcome, context);
    case "failed":
      return {
        text: `${botCopy.saved} ${escapeHtml(failureText(outcome.failure))}`,
        keyboard: outcome.canReadAgain
          ? [[tap(readingCopy.readAgain, { kind: "read_again", id: note.id })]]
          : [],
      };
    case "saved":
      return savedCard(note);
    default:
      return outcome satisfies never;
  }
}

// Xoá asks first, on the card itself, as the web's dialog does
export function deleteNoteQuestion(note: Note): Card {
  return {
    text: deleteQuestion(notesCopy.one),
    keyboard: [
      [
        {
          ...tap(actionLabels.remove, {
            kind: "delete_note",
            id: note.id,
            version: note.audit.version,
          }),
          style: "danger",
        },
        tap(actionLabels.cancel, { kind: "show_note", id: note.id }),
      ],
    ],
  };
}

// After Hoàn tác or Xoá: what went, and the way back while it is in the trash
export function deletedCard(
  restore: Extract<CallbackAction, { kind: "restore_order" | "restore_reminder" | "restore_note" }>,
): Card {
  const said = {
    restore_order: ordersCopy.deleted,
    restore_reminder: remindersCopy.deleted,
    restore_note: notesCopy.deleted,
  } as const;

  return { text: `${said[restore.kind]}.`, keyboard: [[tap(actionLabels.restore, restore)]] };
}

// A card whose note is gone for good, or never was
export function goneCard(text: string): Card {
  return { text: escapeHtml(text), keyboard: [] };
}
