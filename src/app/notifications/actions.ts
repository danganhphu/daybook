"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Inbox from "@/features/notifications/web/inbox-commands";

// The list has been on screen: what it showed unread is read now. Like every change, it clears the browser's copies of
// the screens, so the bell on each tab counts again.
export async function markNotificationsRead(upTo: unknown): Promise<void> {
  const app = daybook();
  const session = await requireSession(app);

  await Inbox.markRead(app, session, upTo);
  refresh();
}
