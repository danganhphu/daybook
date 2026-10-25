import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { readingSchema } from "@/features/reading/domain/reading";
import { weekdayName } from "@/shared/domain/weekday";

// The prompt measured in step 0 of the reading plan (ADR 0012). Any change to its words is a new version, measured
// again on the stored messages before it replaces this one.
export const promptVersion = 1;

const { $schema: _dialect, ...schema } = z.toJSONSchema(readingSchema);

// The schema the answer must follow, as Workers AI's JSON mode takes it and as step 0 sent it
export const responseFormat = { type: "json_schema", json_schema: schema } as const;

const englishWeekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// "Monday 2026-10-26 (Thứ Hai, 26/10/2026)"
function todayLine(today: Temporal.PlainDate): string {
  const english = englishWeekdays[today.dayOfWeek - 1] ?? "";

  return `${english} ${today.toString()} (${weekdayName(today)}, ${today.day}/${today.month}/${today.year})`;
}

const tuesday = 2;

// What the example's "thứ 3" means today: the next Tuesday after it, as the rules above say
function nextTuesday(today: Temporal.PlainDate): Temporal.PlainDate {
  return today.add({ days: (tuesday - today.dayOfWeek + 7) % 7 || 7 });
}

export function systemPrompt(today: Temporal.PlainDate): string {
  return `You read one message that a Vietnamese salesperson of dental supplies typed into her notebook, and return JSON matching the schema. Today is ${todayLine(today)}.

kind:
- "order": she sold or is delivering goods to a customer; the message names products with a quantity or a price.
- "reminder": something to do later (call, visit, send, collect money, deliver on a day) that is not itself a sale.
- "note": anything else: news, prices heard, things already done, payments received, chit-chat.

customer: the customer exactly as written, keeping words like "chị", "anh", "nha khoa", "nk", "phòng khám", "bv"; null if none.

lines: for an order, one per product, else []. product: as written, without the quantity or the unit. quantity: a whole number, or null. price: exactly as written with its unit ("500k", "1tr2", "85 nghìn", "6 triệu"), or null. priceIsPerUnit: true only when the message says the price is for one unit ("mỗi hộp", "/hộp", "1 hộp", "một tuýp"); otherwise false, because a price written after the products is the total for that line.

task: for a reminder, what to do in a few of the message's words; null otherwise.
when: the time words as written ("thứ 5", "mai", "15/11", "cuối tháng"), or null.
dueOn: the date "when" means, as YYYY-MM-DD, counted from today. A weekday ("thứ 2" to "thứ 7", "chủ nhật") is the next one after today; "tuần sau" means next week; "cuối tháng" is the last day of the month; a day of the month alone is this month, or next month if it has passed. null when there are no time words.

Examples:
"bán 3 hộp kim cho chị Mai 600k" -> {"kind":"order","customer":"chị Mai","lines":[{"product":"kim","quantity":3,"price":"600k","priceIsPerUnit":false}],"task":null,"when":null,"dueOn":null}
"thứ 3 gọi nha khoa Hoà Bình" -> {"kind":"reminder","customer":"nha khoa Hoà Bình","lines":[],"task":"gọi","when":"thứ 3","dueOn":"${nextTuesday(today).toString()}"}`;
}
