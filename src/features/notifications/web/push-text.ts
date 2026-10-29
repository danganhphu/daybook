import type { Temporal } from "temporal-polyfill/implementation";

import { backupPasswordTerm, passkeyTerm } from "@/features/access/application/access-terms";
import { formatMoment } from "@/features/access/web/account-view";
import type {
  DueItem,
  MorningContent,
  NoticeContent,
  NotificationContent,
  WeeklyContent,
} from "@/features/notifications/application/notification-content";
import type { PushDelivery, PushMessage } from "@/features/notifications/application/push-sender";
import type { NoticeKind } from "@/features/notifications/domain/notice";
import { overdueBy } from "@/features/reminders/web/reminders-copy";
import { reportsPath } from "@/features/reports/web/reports-path";
import { moneyText } from "@/shared/web/money-text";
import { routes } from "@/shared/web/routes";
import { midSentence } from "@/shared/web/sentence-case";

// What a push notification says. The phone shows a few lines of it, so it names what to do first and counts the rest.

const secondsPerHour = 3600;
// Kept by the push service for a phone that is off: the morning's list is stale by evening, the rest within a day
const morningTtl = 12 * secondsPerHour;
const dayTtl = 24 * secondsPerHour;
// Every one is shown to the person, so each may wake the phone
const urgency = "high";
// How many reminders the body names, and how much of each
const namedReminders = 3;
const lineLength = 80;

function shortened(text: string): string {
  const line = text.replaceAll(/\s+/g, " ").trim();

  return line.length > lineLength ? `${line.slice(0, lineLength - 3).trimEnd()}...` : line;
}

function reminderLine(item: DueItem, day: Temporal.PlainDate): string {
  const late = item.dueOn.until(day, { largestUnit: "days" }).days;
  const customer = item.customerName === undefined ? "" : `, ${item.customerName}`;

  return `${shortened(item.text)}${customer}${late > 0 ? ` (${midSentence(overdueBy(late))})` : ""}`;
}

// The words and where a tap goes; the tag comes from the delivery
type PushText = Omit<PushMessage, "tag">;

function morning(content: MorningContent): PushText {
  const { due, quiet, day } = content;
  const quietLine = quiet.length === 0 ? [] : [`Lâu không đặt: ${quiet.join(", ")}`];
  if (due.length === 0) {
    return {
      title: `${quiet.length} khách lâu không đặt`,
      body: quiet.join(", "),
      path: routes.reports,
    };
  }
  const rest = due.length - namedReminders;

  return {
    title: `Hôm nay có ${due.length} việc`,
    body: [
      ...due.slice(0, namedReminders).map((item) => reminderLine(item, day)),
      ...(rest > 0 ? [`và ${rest} việc nữa`] : []),
      ...quietLine,
    ].join("\n"),
    path: routes.reminders,
  };
}

function weekly(content: WeeklyContent): PushText {
  const quiet = content.quiet > 0 ? ` ${content.quiet} khách lâu không đặt.` : "";

  return {
    title: `Tuần này: ${content.orders} đơn, ${moneyText(content.sales)}`,
    body: `Thu về ${moneyText(content.received)}. Còn nợ ${moneyText(content.owed)}.${quiet}`,
    path: reportsPath({ period: "week", on: content.day.toString() }),
  };
}

const noticeTitles = {
  passkey_added: `Vừa thêm ${passkeyTerm}`,
  passkey_removed: `Vừa xoá ${passkeyTerm}`,
  password_set: `Vừa đặt ${backupPasswordTerm}`,
  password_changed: `Vừa đổi ${backupPasswordTerm}`,
  password_locked: "Mật khẩu bị khoá vì nhập sai nhiều lần",
  username_changed: "Vừa đổi tên đăng nhập",
  setup_link_issued: "Vừa có link khôi phục cho tài khoản của bạn",
  setup_link_redeemed: "Link khôi phục của bạn vừa được mở",
  sessions_revoked: "Tài khoản vừa đăng xuất khỏi mọi thiết bị",
  push_subscribed: "Có thêm một thiết bị nhận thông báo",
} as const satisfies Record<NoticeKind, string>;

// Where a tap goes: the screen that shows what changed
const noticePaths = {
  passkey_added: routes.settingsSignIn,
  passkey_removed: routes.settingsSignIn,
  password_set: routes.settingsSignIn,
  password_changed: routes.settingsSignIn,
  password_locked: routes.settingsSignIn,
  username_changed: routes.settingsAccount,
  setup_link_issued: routes.settingsActivity,
  setup_link_redeemed: routes.settingsActivity,
  sessions_revoked: routes.settingsDevices,
  push_subscribed: routes.settingsNotifications,
} as const satisfies Record<NoticeKind, string>;

function notice({ notice: event, byOther }: NoticeContent): PushText {
  const who = byOther === undefined ? "" : `${byOther} làm. `;

  return {
    title: noticeTitles[event.kind],
    body: `${who}Lúc ${formatMoment(event.occurredAt)}, trên ${event.deviceLabel}. Nếu bạn không biết việc này, hãy mở Cài đặt.`,
    path: noticePaths[event.kind],
  };
}

// A topic (RFC 8030: at most 32 characters of base64url) per digest and day, so a newer copy replaces one still waiting
function digestTopic(kind: string, day: Temporal.PlainDate): string {
  return `${kind}-${day.toString().replaceAll("-", "")}`;
}

export function pushMessageFor(
  content: NotificationContent,
  ref: string,
): { readonly message: PushMessage; readonly delivery: PushDelivery } {
  const tag = `${content.kind}-${ref}`;
  switch (content.kind) {
    case "morning":
      return {
        message: { ...morning(content), tag },
        delivery: {
          ttlSeconds: morningTtl,
          topic: digestTopic(content.kind, content.day),
          urgency,
        },
      };
    case "weekly":
      return {
        message: { ...weekly(content), tag },
        delivery: { ttlSeconds: dayTtl, topic: digestTopic(content.kind, content.day), urgency },
      };
    case "notice":
      return {
        message: { ...notice(content), tag },
        delivery: { ttlSeconds: dayTtl, topic: undefined, urgency },
      };
    default:
      return content satisfies never;
  }
}
