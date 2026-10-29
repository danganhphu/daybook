import type { Metadata } from "next";

import { openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { inboxView } from "@/features/notifications/web/inbox-commands";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";

import { NotificationsScreen } from "./notifications-screen";

export const metadata: Metadata = { title: notificationsCopy.title };

// New notifications arrive between visits
export const dynamic = "force-dynamic";

export default async function NotificationsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, from] = await Promise.all([inboxView(app, session), openedFrom(props)]);

  return <NotificationsScreen view={view} back={from} />;
}
