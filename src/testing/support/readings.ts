import type { MessageReader } from "@/features/reading/application/message-reader";
import type { ReadLine, Reading } from "@/features/reading/domain/reading";
import {
  createReplayReader,
  type ReplayAnswer,
} from "@/features/reading/infrastructure/replay-reader";

// Readings as a model answers them, for tests that read notes without one

// A message read as a plain note unless the test says otherwise
export function aReading(fields: Partial<Reading>): Reading {
  return {
    kind: "note",
    customer: null,
    lines: [],
    task: null,
    when: null,
    dueOn: null,
    ...fields,
  };
}

export function aLine(
  product: string,
  quantity: number | null,
  price: string | null,
  priceIsPerUnit = false,
): ReadLine {
  return { product, quantity, price, priceIsPerUnit };
}

export function anOrderReading(customer: string | null, lines: ReadonlyArray<ReadLine>): Reading {
  return aReading({ kind: "order", customer, lines: [...lines] });
}

export function aReminderReading(
  customer: string | null,
  when: string | null,
  dueOn: string | null,
): Reading {
  return aReading({ kind: "reminder", customer, task: "gọi", when, dueOn });
}

// Answers each message as the table says; any other is a plain note
export function readerOf(answers: Readonly<Record<string, ReplayAnswer>>): MessageReader {
  return createReplayReader(new Map(Object.entries(answers)));
}
