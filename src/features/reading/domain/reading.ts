import { z } from "zod";

import { orderLimits } from "@/features/orders/domain/order";

// What a message says it is, as a model read it (ADR 0012). The words stay as written - the customer, each product,
// the price, the time - and our code turns them into ids, money and days. Nulls are what the message does not say;
// the same schema checks every answer and is the JSON schema the model is asked to follow.
export const readingKinds = ["order", "reminder", "note"] as const;

export type ReadingKind = (typeof readingKinds)[number];

// Long enough for any name or phrase in a note, short enough that a runaway answer is refused
export const readingWordsMaxLength = 200;

const words = z.string().min(1).max(readingWordsMaxLength);

export const readLineSchema = z.object({
  product: words,
  quantity: z.int().min(1).max(orderLimits.quantity).nullable(),
  price: words.nullable(),
  // A written price is the line's total unless the message says it is for one unit
  priceIsPerUnit: z.boolean(),
});

export type ReadLine = z.infer<typeof readLineSchema>;

export const readingSchema = z.object({
  kind: z.enum(readingKinds),
  customer: words.nullable(),
  lines: z.array(readLineSchema).max(orderLimits.lines),
  // A reminder's errand, in the message's words
  task: words.nullable(),
  // The time words as written ("thứ 5", "mai"), and the day they mean, YYYY-MM-DD
  when: words.nullable(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export type Reading = z.infer<typeof readingSchema>;
