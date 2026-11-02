import type { Temporal } from "temporal-polyfill/implementation";

import type {
  DueItem,
  MorningContent,
  NotificationContent,
  PeriodSummary,
} from "@/features/notifications/application/notification-content";
import {
  pushMessageFor,
  quietNames,
  reminderLine,
  summaryText,
  type PushText,
} from "@/features/notifications/web/push-text";
import type { OrderRow, OrderTotals } from "@/features/orders/application/order-queries";
import { moreDue, remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { dayLabel } from "@/shared/web/day-label";
import { moneyText } from "@/shared/web/money-text";
import { routes } from "@/shared/web/routes";

import { botCopy } from "./bot-copy";
import type { Card, CardContext } from "./cards";
import { escapeHtml } from "./html";
import { rows, tap, urlButton } from "./keyboard";

// The lists the bot sends: the morning's, /today, /reminders, the summaries and the notices

// How many reminders a message names, each with its own Xong; the rest are counted
export const listedReminders = 10;

// Xong buttons read "Xong 1", "Xong 2": a row of them fits a phone
const doneButtonsPerRow = 5;

// "Việc cần nhắc: 3"
function dueCount(count: number): string {
  return `${remindersCopy.title}: ${count}`;
}

// Numbered lines, and a Xong for each that marks that reminder done as it stood
function dueLines(items: ReadonlyArray<DueItem>, day: Temporal.PlainDate) {
  const listed = items.slice(0, listedReminders);
  const rest = items.length - listed.length;
  const lines = [
    ...listed.map((item, index) => `${index + 1}. ${escapeHtml(reminderLine(item, day))}`),
    ...(rest > 0 ? [moreDue(rest)] : []),
  ];
  const buttons = listed.map((item, index) =>
    tap(`${actionLabels.done} ${index + 1}`, {
      kind: "complete_reminder",
      id: item.reminderId,
      version: item.version,
    }),
  );

  return { lines, doneRows: rows(buttons, doneButtonsPerRow) };
}

// The push's title, every reminder up to ten with its Xong, and the customers gone quiet
function morningCard(content: MorningContent, ref: string, context: CardContext): Card {
  const { title, path } = pushMessageFor(content, ref).message;
  const { lines, doneRows } = dueLines(content.due, content.day);
  const quiet = content.quiet.length === 0 ? [] : [escapeHtml(quietNames(content.quiet))];
  const gap = lines.length > 0 && quiet.length > 0 ? [""] : [];

  return {
    text: [`<b>${escapeHtml(title)}</b>`, ...lines, ...gap, ...quiet].join("\n"),
    keyboard: [...doneRows, [urlButton(botCopy.open, path, context)]],
  };
}

function textCard(text: PushText, button: string, context: CardContext): Card {
  return {
    text: `<b>${escapeHtml(text.title)}</b>\n${escapeHtml(text.body)}`,
    keyboard: [[urlButton(button, text.path, context)]],
  };
}

// A notification as the bot sends it: the push's words, with buttons a push cannot have
export function notificationCard(
  content: NotificationContent,
  ref: string,
  context: CardContext,
): Card {
  switch (content.kind) {
    case "morning":
      return morningCard(content, ref, context);
    case "weekly":
      return textCard(pushMessageFor(content, ref).message, botCopy.openReports, context);
    case "notice":
      return textCard(pushMessageFor(content, ref).message, botCopy.openSettings, context);
    default:
      return content satisfies never;
  }
}

// /week and /month
export function summaryCard(summary: PeriodSummary, context: CardContext): Card {
  return textCard(summaryText(summary), botCopy.openReports, context);
}

export type TodayList = {
  readonly orders: ReadonlyArray<OrderRow>;
  readonly totals: OrderTotals;
  // Due today or before, soonest first
  readonly due: ReadonlyArray<DueItem>;
};

// /today: the day's orders with their total, then what needs doing
export function todayCard(list: TodayList, context: CardContext): Card {
  const heading = `<b>Hôm nay, ${dayLabel(context.today, context.today)}</b>`;
  if (list.orders.length === 0 && list.due.length === 0) {
    return {
      text: `${heading}\n${botCopy.nothingToday}`,
      keyboard: [[urlButton(botCopy.openWeb, routes.today, context)]],
    };
  }
  const orders = list.orders.map(
    (order) =>
      `- ${escapeHtml(order.customerName)}: ${escapeHtml(order.productNames.join(", "))}, ${moneyText(order.total)}`,
  );
  const { lines, doneRows } = dueLines(list.due, context.today);

  return {
    text: [
      heading,
      `${list.totals.count} đơn, ${moneyText(list.totals.total)}`,
      ...orders,
      ...(lines.length === 0 ? [] : ["", dueCount(list.due.length), ...lines]),
    ].join("\n"),
    keyboard: [...doneRows, [urlButton(botCopy.openWeb, routes.today, context)]],
  };
}

// /reminders: every open reminder, soonest first
export function remindersCard(due: ReadonlyArray<DueItem>, context: CardContext): Card {
  if (due.length === 0) {
    return {
      text: botCopy.noReminders,
      keyboard: [[urlButton(botCopy.open, routes.reminders, context)]],
    };
  }
  const { lines, doneRows } = dueLines(due, context.today);

  return {
    text: [`<b>${dueCount(due.length)}</b>`, ...lines].join("\n"),
    keyboard: [...doneRows, [urlButton(botCopy.open, routes.reminders, context)]],
  };
}

// /web and /settings: a button into the app
export function linkCard(text: string, button: string, path: string, context: CardContext): Card {
  return { text: escapeHtml(text), keyboard: [[urlButton(button, path, context)]] };
}
