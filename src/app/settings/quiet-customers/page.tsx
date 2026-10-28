import type { Metadata } from "next";

import { QuietCustomersSection } from "@/app/settings/quiet-customers-section";
import { settingsCopy } from "@/app/settings/settings-copy";
import { openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { bookSettingView } from "@/features/book-settings/web/book-setting-commands";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.quiet };

export const dynamic = "force-dynamic";

export default async function QuietCustomersSettingsPage(props: SettingsPageProps) {
  const app = daybook();
  await requireSession(app);
  const [view, from] = await Promise.all([bookSettingView(app), openedFrom(props)]);

  return <QuietCustomersSection view={view} back={settingsPath(from)} />;
}
