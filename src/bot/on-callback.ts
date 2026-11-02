import { telegramUserIdSchema } from "@/features/access/domain/telegram-link";
import type { CaptureId } from "@/features/capture/domain/capture";
import { noteErrorMessages } from "@/features/notes/application/note-errors";
import type { Note } from "@/features/notes/domain/note";
import { orderErrorMessages } from "@/features/orders/application/order-errors";
import type { ReadingAnswer } from "@/features/reading/application/answer-reading";
import { readingErrorMessages } from "@/features/reading/application/reading-errors";
import { readingCopy } from "@/features/reading/web/reading-copy";
import { reminderErrorMessages } from "@/features/reminders/application/reminder-errors";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";

import { cardParams, type Bot, type WebhookAnswer } from "./bot";
import { botCopy } from "./bot-copy";
import { customerTail, parseCallbackData, type CallbackAction } from "./callback-data";
import { deleteNoteQuestion, deletedCard, goneCard, messageCard, type Card } from "./cards";
import { messageOutcome } from "./message-outcome";
import { isPrivate, type TelegramCallbackQuery } from "./telegram-update";

// What a tap comes to: a few words in the toast Telegram shows, the card redrawn, or both
type Tapped = { readonly toast?: string; readonly card?: Card };

type Tap = {
  readonly bot: Bot;
  readonly by: AccountId;
  readonly chatId: number;
  readonly cardId: number;
};

async function cardFor(tap: Tap, note: Note | undefined): Promise<Tapped> {
  if (note?.status !== "live") {
    return { card: goneCard(noteErrorMessages.note_not_found) };
  }

  return {
    card: messageCard(note, await messageOutcome(tap.bot.app, note), {
      appOrigin: tap.bot.appOrigin,
      today: tap.bot.app.today(),
    }),
  };
}

async function cardFrom(tap: Tap, captureId: CaptureId | undefined): Promise<Tapped> {
  return cardFor(tap, captureId === undefined ? undefined : await tap.bot.app.noteFrom(captureId));
}

async function answer(tap: Tap, note: Note | undefined, said: ReadingAnswer): Promise<Tapped> {
  if (note?.status !== "live") {
    return { toast: readingErrorMessages.note_unavailable };
  }
  const answered = await tap.bot.app.answerReading({ by: tap.by, noteId: note.id, answer: said });

  return answered.ok ? cardFor(tap, note) : { toast: readingErrorMessages[answered.error] };
}

// Which customer the n-th button names, if the reading still asks and the list has not changed since the card
async function candidateAt(
  tap: Tap,
  note: Note | undefined,
  action: Extract<CallbackAction, { kind: "answer_customer" }>,
) {
  const state = note === undefined ? undefined : await tap.bot.app.readingState(note.captureId);
  const customer = state?.kind === "unsure" ? state.candidates[action.candidate] : undefined;

  return customer !== undefined && customerTail(customer.id) === action.customerTail
    ? customer
    : undefined;
}

async function act(tap: Tap, action: CallbackAction): Promise<Tapped> {
  const { app } = tap.bot;
  switch (action.kind) {
    case "undo_order": {
      const deleted = await app.deleteOrder({ id: action.id, by: tap.by, shown: action.version });
      return deleted.ok
        ? {
            card: deletedCard({
              kind: "restore_order",
              id: action.id,
              version: deleted.value.audit.version,
            }),
          }
        : { toast: orderErrorMessages[deleted.error] };
    }
    case "restore_order": {
      const restored = await app.restoreOrder({ id: action.id, by: tap.by, shown: action.version });
      return restored.ok
        ? cardFrom(tap, restored.value.captureId)
        : { toast: orderErrorMessages[restored.error] };
    }
    case "undo_reminder": {
      const deleted = await app.deleteReminder({
        id: action.id,
        by: tap.by,
        shown: action.version,
      });
      return deleted.ok
        ? {
            card: deletedCard({
              kind: "restore_reminder",
              id: action.id,
              version: deleted.value.audit.version,
            }),
          }
        : { toast: reminderErrorMessages[deleted.error] };
    }
    case "restore_reminder": {
      const restored = await app.restoreReminder({
        id: action.id,
        by: tap.by,
        shown: action.version,
      });
      return restored.ok
        ? cardFrom(tap, restored.value.captureId)
        : { toast: reminderErrorMessages[restored.error] };
    }
    case "complete_reminder": {
      const done = await app.completeReminder({ id: action.id, by: tap.by, shown: action.version });
      return { toast: done.ok ? botCopy.markedDone : reminderErrorMessages[done.error] };
    }
    case "ask_delete_note": {
      const note = await app.getNote(action.id);
      if (note?.status !== "live") {
        return { card: goneCard(noteErrorMessages.note_not_found) };
      }
      return Audits.isCurrent(note.audit, action.version)
        ? { card: deleteNoteQuestion(note) }
        : { toast: noteErrorMessages.note_changed_elsewhere };
    }
    case "delete_note": {
      const deleted = await app.deleteNote({ id: action.id, by: tap.by, shown: action.version });
      return deleted.ok
        ? {
            card: deletedCard({
              kind: "restore_note",
              id: action.id,
              version: deleted.value.audit.version,
            }),
          }
        : { toast: noteErrorMessages[deleted.error] };
    }
    case "restore_note": {
      const restored = await app.restoreNote({ id: action.id, by: tap.by, shown: action.version });
      return restored.ok
        ? cardFor(tap, restored.value)
        : { toast: noteErrorMessages[restored.error] };
    }
    case "show_note":
      return cardFor(tap, await app.getNote(action.id));
    case "answer_customer": {
      const note = await app.getNote(action.id);
      const customer = await candidateAt(tap, note, action);
      return customer === undefined
        ? { toast: readingErrorMessages.not_asked, ...(await cardFor(tap, note)) }
        : answer(tap, note, { kind: "customer", customerId: customer.id });
    }
    case "answer_new_customer":
      return answer(tap, await app.getNote(action.id), { kind: "new_customer" });
    case "answer_not_order":
      return answer(tap, await app.getNote(action.id), { kind: "dismiss" });
    case "read_again":
      // The card is redrawn in place, so the message it answers is not needed again
      await app.replies.send([
        {
          kind: "reply",
          accountId: tap.by,
          noteId: action.id,
          chatId: tap.chatId,
          messageId: tap.cardId,
          again: true,
          cardId: tap.cardId,
        },
      ]);
      return { toast: readingCopy.reading };
    default:
      return action satisfies never;
  }
}

// A button on one of the bot's cards. Checked like a message: her own chat, a linked Telegram user. Telegram gets its
// answer at once, with the toast; the card is redrawn after, in the request's waitUntil, since a failed redraw loses
// nothing a second tap cannot redo.
export async function onCallback(
  bot: Bot,
  query: TelegramCallbackQuery,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<WebhookAnswer> {
  const done: WebhookAnswer = { method: "answerCallbackQuery", callback_query_id: query.id };
  const { message } = query;
  const userId = telegramUserIdSchema.safeParse(query.from.id);
  const action = parseCallbackData(query.data ?? "");
  if (
    message === undefined ||
    !isPrivate(message.chat) ||
    !userId.success ||
    action === undefined
  ) {
    return done;
  }
  const linked = await bot.app.linkFor(userId.data);
  if (linked === undefined) {
    return done;
  }

  const tapped = await act(
    { bot, by: linked.accountId, chatId: message.chat.id, cardId: message.message_id },
    action,
  );
  if (tapped.card !== undefined) {
    waitUntil(
      bot.api.editMessageText({
        chat_id: message.chat.id,
        message_id: message.message_id,
        ...cardParams(tapped.card),
      }),
    );
  }

  return tapped.toast === undefined ? done : { ...done, text: tapped.toast };
}
