import type { Temporal } from "temporal-polyfill/implementation";

import type { OrderMadeFrom } from "@/features/orders/application/order-queries";
import type { ReadFailure } from "@/features/reading/domain/interpretation";
import type { LiveReminder } from "@/features/reminders/domain/reminder";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { dayLabel } from "@/shared/web/day-label";
import { moneyText } from "@/shared/web/money-text";

import { lineText, readingCopy } from "./reading-copy";

// What came of a message, in the words the day's page and the bot's card both use. Plain text: the bot escapes it.

export function orderSummary(order: OrderMadeFrom): string {
  const lines = order.lines.map((line) => lineText(line.productName, line.quantity)).join(", ");
  const priced = order.lines.every((line) => line.unitPrice > 0);

  return `${order.customerName}: ${lines}, ${priced ? moneyText(order.total) : readingCopy.unpriced}`;
}

export function dueWords(reminder: LiveReminder, today: Temporal.PlainDate): string {
  if (reminder.completion !== undefined) {
    return remindersCopy.done;
  }
  const days = today.until(reminder.dueOn, { largestUnit: "days" }).days;

  return days === 0
    ? remindersCopy.today
    : days === 1
      ? remindersCopy.tomorrow
      : dayLabel(reminder.dueOn, today);
}

export function failureText(failure: ReadFailure): string {
  switch (failure) {
    case "quota":
      return readingCopy.quota;
    case "refused":
      return readingCopy.refused;
    case "schema":
    case "timeout":
    case "error":
      return readingCopy.failed;
    default:
      return failure satisfies never;
  }
}
