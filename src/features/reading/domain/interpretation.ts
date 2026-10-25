import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { AccountId } from "@/shared/domain/account-id";

import type { Reading } from "./reading";

export const interpretationIdSchema = z.uuid().brand<"InterpretationId">();

export type InterpretationId = z.infer<typeof interpretationIdSchema>;

export const interpretationOutcomes = ["order", "reminder", "note", "unsure", "failed"] as const;

export type InterpretationOutcome = (typeof interpretationOutcomes)[number];

// Why nothing came of a reading: the answer broke the schema, the day's allowance was spent, the model took too long,
// the call failed, or the order it described was refused by the order's own rules
export const readFailures = ["schema", "quota", "timeout", "error", "refused"] as const;

export type ReadFailure = (typeof readFailures)[number];

// Why a reading waits for a person: the customer it names matches nobody, or more than one
export const customerQuestions = ["unknown", "ambiguous"] as const;

export type CustomerQuestion = (typeof customerQuestions)[number];

// Who read the message: a model with a prompt, or a person answering what a model left open
export type Reader = { readonly model: string; readonly promptVersion: number };

export const personReader: Reader = { model: "person", promptVersion: 0 };

type Fields = {
  readonly id: InterpretationId;
  readonly captureId: CaptureId;
  readonly reader: Reader;
  readonly readAt: Temporal.Instant;
  // Whose request read it
  readonly readBy: AccountId;
  // What the model's call cost, when a model made it
  readonly neurons: number | undefined;
};

// One reading of one capture, never changed: reading again adds another. What was made from it - an order, a
// reminder - carries the capture's id, so it is found from the capture, not from here.
export type Interpretation =
  | (Fields & { readonly outcome: "order" | "reminder" | "note"; readonly reading: Reading })
  | (Fields & {
      readonly outcome: "unsure";
      readonly reading: Reading;
      readonly question: CustomerQuestion;
      readonly candidates: ReadonlyArray<CustomerId>;
    })
  | (Fields & { readonly outcome: "failed"; readonly failure: ReadFailure });

// Who read what, when, for whom, and at what cost
export type ReadingContext = Omit<Fields, "id">;

function newId(): InterpretationId {
  return interpretationIdSchema.parse(uuidv7());
}

// Something was made of it - an order, a reminder - or it was taken as a note
export function understood(
  context: ReadingContext,
  outcome: "order" | "reminder" | "note",
  reading: Reading,
): Interpretation {
  return { ...context, id: newId(), outcome, reading };
}

export function unsure(
  context: ReadingContext,
  reading: Reading,
  question: CustomerQuestion,
  candidates: ReadonlyArray<CustomerId>,
): Interpretation {
  return { ...context, id: newId(), outcome: "unsure", reading, question, candidates };
}

export function failed(context: ReadingContext, failure: ReadFailure): Interpretation {
  return { ...context, id: newId(), outcome: "failed", failure };
}
