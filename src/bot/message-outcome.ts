import type { BotApp } from "@/composition/bot-app";
import type { Note } from "@/features/notes/domain/note";
import { isWorthReadingAgain } from "@/features/reading/domain/interpretation";
import { periodContaining } from "@/features/reports/domain/report-period";

import type { MessageOutcome } from "./cards";

// What a note's message became, as its card shows it: the order with its version and the month so far, the reminder,
// the question it waits on, a failed reading, or a note
export async function messageOutcome(app: BotApp, note: Note): Promise<MessageOutcome> {
  const state = await app.readingState(note.captureId);
  switch (state?.kind) {
    case undefined:
    case "unread":
      return { kind: "saved" };
    case "order": {
      const order = await app.getOrder(state.order.orderId);
      if (order === undefined) {
        return { kind: "saved" };
      }
      const { from, to } = periodContaining("month", order.orderedOn);
      return {
        kind: "order",
        order: state.order,
        version: order.audit.version,
        month: await app.orderTotals({ from, to }),
      };
    }
    case "reminder":
      return { kind: "reminder", reminder: state.reminder };
    case "unsure":
      return {
        kind: "unsure",
        question: state.question,
        written: state.written ?? undefined,
        candidates: state.candidates,
      };
    case "failed":
      return {
        kind: "failed",
        failure: state.failure,
        canReadAgain: app.canRead() && isWorthReadingAgain(state.failure),
      };
    default:
      return state satisfies never;
  }
}
