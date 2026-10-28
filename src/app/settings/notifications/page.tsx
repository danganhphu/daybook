import type { Metadata } from "next";

import { NotificationsSection } from "@/app/settings/notifications-section";
import { settingsCopy } from "@/app/settings/settings-copy";
import { openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook, pushPublicKey } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { notificationsView } from "@/features/notifications/web/notification-commands";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.notifications };

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, from] = await Promise.all([
    notificationsView(app, session, pushPublicKey()),
    openedFrom(props),
  ]);

  return <NotificationsSection view={view} back={settingsPath(from)} />;
}
