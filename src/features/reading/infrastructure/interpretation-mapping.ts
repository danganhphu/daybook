import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { captureIdSchema } from "@/features/capture/domain/capture";
import { customerIdSchema } from "@/features/customers/domain/customer";
import {
  customerQuestions,
  interpretationIdSchema,
  readFailures,
  type Interpretation,
} from "@/features/reading/domain/interpretation";
import { readingSchema } from "@/features/reading/domain/reading";
import { accountIdSchema } from "@/shared/domain/account-id";

import type { interpretationTable } from "./interpretation.table";

type Row = typeof interpretationTable.$inferSelect;

// What the result column holds: the reading, and for an unsure one what it asks and of whom
const resultSchema = z.object({
  reading: readingSchema,
  question: z.enum(customerQuestions).optional(),
  candidates: z.array(customerIdSchema).optional(),
});

export function toInterpretationRow(interpretation: Interpretation): Row {
  const common = {
    id: interpretation.id,
    captureId: interpretation.captureId,
    model: interpretation.reader.model,
    promptVersion: interpretation.reader.promptVersion,
    outcome: interpretation.outcome,
    neurons: interpretation.neurons ?? null,
    readAt: interpretation.readAt.epochMilliseconds,
    readBy: interpretation.readBy,
  };
  switch (interpretation.outcome) {
    case "failed":
      return { ...common, result: null, failure: interpretation.failure };
    case "unsure":
      return {
        ...common,
        result: JSON.stringify({
          reading: interpretation.reading,
          question: interpretation.question,
          candidates: interpretation.candidates,
        }),
        failure: null,
      };
    default:
      return {
        ...common,
        result: JSON.stringify({ reading: interpretation.reading }),
        failure: null,
      };
  }
}

export function fromInterpretationRow(row: Row): Interpretation {
  const context = {
    id: interpretationIdSchema.parse(row.id),
    captureId: captureIdSchema.parse(row.captureId),
    reader: { model: row.model, promptVersion: row.promptVersion },
    readAt: Temporal.Instant.fromEpochMilliseconds(row.readAt),
    readBy: accountIdSchema.parse(row.readBy),
    neurons: row.neurons ?? undefined,
  };
  if (row.outcome === "failed") {
    return { ...context, outcome: "failed", failure: z.enum(readFailures).parse(row.failure) };
  }

  const result = resultSchema.parse(JSON.parse(row.result ?? "null"));
  if (row.outcome === "unsure") {
    return {
      ...context,
      outcome: "unsure",
      reading: result.reading,
      question: z.enum(customerQuestions).parse(result.question),
      candidates: result.candidates ?? [],
    };
  }

  return {
    ...context,
    outcome: z.enum(["order", "reminder", "note"]).parse(row.outcome),
    reading: result.reading,
  };
}
