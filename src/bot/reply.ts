import type { DeliveryOutcome } from "@/features/notifications/application/deliver-notification";

import { cardParams, type Bot } from "./bot";
import { messageCard } from "./cards";
import { messageOutcome } from "./message-outcome";
import type { ReplyJob } from "./reply-job";

const done: DeliveryOutcome = { kind: "done" };

// The queue's half of a message: read it, then answer with its card (ADR 0013, decision 4). Read once - a job that
// runs again finds it read and answers with what came of it - so a retry never makes a second order; it may send a
// second card, which acts on the same records through their versions.
export async function replyToMessage(bot: Bot, job: ReplyJob): Promise<DeliveryOutcome> {
  const { app } = bot;
  const note = await app.getNote(job.noteId);
  if (note?.status !== "live") {
    // Deleted on the web before the reading: nothing to answer
    return done;
  }
  if (app.canRead()) {
    // Already read, by an earlier run or the other person, is fine: the card shows what came of it
    await app.readNote({ by: job.accountId, noteId: note.id, again: job.again });
  }

  const card = messageCard(note, await messageOutcome(app, note), {
    appOrigin: bot.appOrigin,
    today: app.today(),
  });
  const sent =
    job.cardId === undefined
      ? await bot.api.sendMessage({
          chat_id: job.chatId,
          reply_parameters: { message_id: job.messageId, allow_sending_without_reply: true },
          ...cardParams(card),
        })
      : await bot.api.editMessageText({
          chat_id: job.chatId,
          message_id: job.cardId,
          ...cardParams(card),
        });
  if (sent.ok) {
    return done;
  }

  switch (sent.error.kind) {
    case "retry":
      return { kind: "retry", afterSeconds: sent.error.afterSeconds };
    case "blocked":
    case "refused":
      // She blocked the bot, or Telegram will not take it however often it is sent; the note is on the web
      return done;
    default:
      return sent.error satisfies never;
  }
}
