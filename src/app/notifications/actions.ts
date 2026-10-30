"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Inbox from "@/features/notifications/web/inbox-commands";
import type { Result } from "@/shared/domain/result";

// The list has been on screen: what it showed unread is read now. Like every change, it clears the browser's copies of
// the screens, so the bell on each tab counts again.
export async function markNotificationsRead(upTo: unknown): Promise<void> {
  const app = daybook();
  const session = await requireSession(app);

  await Inbox.markRead(app, session, upTo);
  refresh();
}

export async function deleteNotifications(ids: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Inbox.deleteNotifications(app, session, ids);
  refresh();

  return result;
}

export async function deleteAllNotifications(): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Inbox.deleteAllNotifications(app, session);
  refresh();

  return result;
}
