import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { noteIdSchema } from "@/features/notes/domain/note";
import {
  readingErrorMessages,
  type ReadingError,
} from "@/features/reading/application/reading-errors";
import type { ReadingState } from "@/features/reading/application/reading-states";
import type { Settlement } from "@/features/reading/application/settlement";
import { isWorthReadingAgain } from "@/features/reading/domain/interpretation";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";
import { orderPath, routes } from "@/shared/web/routes";

import { dueWords, failureText, orderSummary } from "./reading-text";
import type { DayReadings, MadeView, ReadingView, ReadResult } from "./reading-view";

function toView(state: ReadingState, today: Temporal.PlainDate, canRead: boolean): ReadingView {
  switch (state.kind) {
    case "unread":
      return { kind: "unread" };
    case "order":
      return {
        kind: "order",
        path: orderPath(state.order.orderId),
        summary: orderSummary(state.order),
      };
    case "reminder":
      return { kind: "reminder", path: routes.reminders, due: dueWords(state.reminder, today) };
    case "unsure":
      return {
        kind: "unsure",
        question: state.question,
        written: state.written ?? undefined,
        candidates: state.candidates.map((customer) => ({
          id: customer.id,
          name: customer.name,
          area: customer.area,
        })),
      };
    case "failed":
      return {
        kind: "failed",
        message: failureText(state.failure),
        canReadAgain: canRead && isWorthReadingAgain(state.failure),
      };
    default:
      return state satisfies never;
  }
}

// What each of a day's notes shows about its message. The day's notes are listed again here, one small query in
// parallel with the screen's own, so the notes screen knows nothing about reading.
export async function dayReadings(app: App, day: Temporal.PlainDate): Promise<DayReadings> {
  const notes = await app.listNotesForDay(day);
  const states = await app.readingStates(notes.map((note) => note.captureId));
  const today = app.today();
  const canRead = app.canRead();

  return {
    canRead,
    byNote: Object.fromEntries(
      notes.flatMap((note) => {
        const state = states.get(note.captureId);
        return state === undefined ? [] : [[note.id, toView(state, today, canRead)]];
      }),
    ),
  };
}

function made(settlement: Settlement): MadeView {
  if (settlement.order !== undefined) {
    const { order } = settlement.order;
    return { kind: "order", id: order.id, version: order.audit.version };
  }
  if (settlement.reminder !== undefined) {
    return {
      kind: "reminder",
      id: settlement.reminder.id,
      version: settlement.reminder.audit.version,
    };
  }

  return { kind: "nothing" };
}

function answered(result: Result<Settlement, ReadingError>): ReadResult {
  if (result.ok) {
    return ok(made(result.value));
  }

  // Someone else read or answered it first; the refreshed screen shows what came of it
  return result.error === "already_read" || result.error === "not_asked"
    ? ok({ kind: "nothing" })
    : err(readingErrorMessages[result.error]);
}

export async function readNote(
  app: App,
  by: AccountId,
  noteId: unknown,
  again: unknown,
): Promise<ReadResult> {
  const id = noteIdSchema.safeParse(noteId);
  if (!id.success) {
    return err(readingErrorMessages.note_unavailable);
  }

  return answered(await app.readNote({ by, noteId: id.data, again: again === true }));
}

const answerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("customer"), customerId: customerIdSchema }),
  z.object({ kind: z.literal("new_customer") }),
  z.object({ kind: z.literal("dismiss") }),
]);

export async function answerReading(
  app: App,
  by: AccountId,
  noteId: unknown,
  answer: unknown,
): Promise<ReadResult> {
  const id = noteIdSchema.safeParse(noteId);
  const parsed = answerSchema.safeParse(answer);
  if (!id.success || !parsed.success) {
    return err(readingErrorMessages.note_unavailable);
  }

  return answered(await app.answerReading({ by, noteId: id.data, answer: parsed.data }));
}
