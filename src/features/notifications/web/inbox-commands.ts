import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import type { Session } from "@/features/access/domain/session";
import { deliveryRetentionDays } from "@/features/notifications/domain/delivery";
import * as InboxItems from "@/features/notifications/domain/inbox-item";
import type { InboxItem } from "@/features/notifications/domain/inbox-item";
import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";

import type { InboxRowView, InboxView } from "./inbox-view";
import { keptFor, notificationsCopy } from "./notifications-copy";

// What the list behind the bell does for each request, minus the framework

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

// The time today, "Hôm qua", or the day, with the year only when it is not this one
function whenMade(at: Temporal.Instant, today: Temporal.PlainDate): string {
  const moment = at.toZonedDateTimeISO(vietnamTimeZone);
  const day = moment.toPlainDate();
  const daysAgo = day.until(today, { largestUnit: "days" }).days;
  if (daysAgo === 0) {
    return `${twoDigits(moment.hour)}:${twoDigits(moment.minute)}`;
  }
  if (daysAgo === 1) {
    return notificationsCopy.yesterday;
  }

  return day.year === today.year
    ? `${day.day}/${day.month}`
    : `${day.day}/${day.month}/${day.year}`;
}

function rowOf(item: InboxItem, today: Temporal.PlainDate): InboxRowView {
  return {
    id: item.id,
    subject: item.subject,
    title: item.title,
    body: item.body,
    when: whenMade(item.createdAt, today),
    href: item.path,
    unread: InboxItems.isUnread(item),
  };
}

export async function inboxView(app: App, session: Session): Promise<InboxView> {
  const items = await app.notificationInbox(session);
  const today = app.today();
  const newest = items[0];

  return {
    rows: items.map((item) => rowOf(item, today)),
    footer: keptFor(deliveryRetentionDays),
    readUpTo:
      newest !== undefined && items.some(InboxItems.isUnread)
        ? newest.createdAt.epochMilliseconds
        : undefined,
  };
}

export function unreadNotifications(app: App, session: Session): Promise<number> {
  return app.unreadNotifications(session);
}

const readUpToSchema = z.int().nonnegative();

// The screen sends back the time it was given; anything else is not from it, and changes nothing
export async function markRead(app: App, session: Session, upTo: unknown): Promise<void> {
  const parsed = readUpToSchema.safeParse(upTo);
  if (!parsed.success) {
    return;
  }

  await app.markInboxRead(session, Temporal.Instant.fromEpochMilliseconds(parsed.data));
}
