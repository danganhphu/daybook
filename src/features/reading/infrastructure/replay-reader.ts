import { z } from "zod";

import type { MessageReader } from "@/features/reading/application/message-reader";
import { readFailures, type Reader } from "@/features/reading/domain/interpretation";
import { readingSchema, type Reading } from "@/features/reading/domain/reading";
import { err, ok } from "@/shared/domain/result";

// Stands in for a model where none may be called: the unit tests and the end-to-end build (ADR 0012). It answers
// from a table of messages and what each says, the same every time; a message not in the table is a plain note, as
// most messages are.
export const replayReader: Reader = { model: "replay", promptVersion: 0 };

const plainNote: Reading = {
  kind: "note",
  customer: null,
  lines: [],
  task: null,
  when: null,
  dueOn: null,
};

// A message's answer: what it says, or how reading it fails
export const replayAnswerSchema = z.union([
  readingSchema,
  z.enum(readFailures).exclude(["refused"]),
]);

export type ReplayAnswer = z.infer<typeof replayAnswerSchema>;

// The table as the end-to-end build is given it, JSON in a binding: message to answer
export const replayTableSchema = z.record(z.string(), replayAnswerSchema);

export function createReplayReader(answers: ReadonlyMap<string, ReplayAnswer>): MessageReader {
  return {
    async read(text) {
      const answer = answers.get(text) ?? plainNote;

      return typeof answer === "string"
        ? err({ failure: answer, reader: replayReader, neurons: undefined })
        : ok({ reading: answer, reader: replayReader, neurons: undefined });
    },
  };
}
