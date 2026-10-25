import type { Temporal } from "temporal-polyfill/implementation";

import type { ReplayAnswer } from "@/features/reading/infrastructure/replay-reader";
import { aLine, anOrderReading, aReminderReading } from "@/testing/support/readings";

// What the end-to-end build's stand-in for the model answers, for the messages reading.feature sends. Any other
// message is a plain note, so every other scenario reads as it did before reading began. Orders go to Sao Mai, whose
// figures no other scenario checks; Hướng Dương's are.
const messages = {
  order: "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k",
  reminder: "mai gọi đại lý Sao Mai hỏi lịch giao",
  unknownCustomer: "bán 1 hộp kim nha khoa cho chị Lan 400k",
  notAnOrder: "chị Lan lấy 2 hộp găng tay 90k",
  failing: "tin này đọc không được",
  quota: "hôm nay hết lượt đọc",
} as const;

// Days are counted from the day the server starts, as a model counts them from the day a message is sent
export function readingsFor(today: Temporal.PlainDate): Record<string, ReplayAnswer> {
  return {
    [messages.order]: anOrderReading("đại lý Sao Mai", [aLine("thuốc tê", 2, "500k")]),
    [messages.reminder]: aReminderReading(
      "đại lý Sao Mai",
      "mai",
      today.add({ days: 1 }).toString(),
    ),
    [messages.unknownCustomer]: anOrderReading("chị Lan", [aLine("kim nha khoa", 1, "400k")]),
    [messages.notAnOrder]: anOrderReading("chị Lan", [aLine("găng tay", 2, "90k")]),
    [messages.failing]: "error",
    [messages.quota]: "quota",
  };
}
