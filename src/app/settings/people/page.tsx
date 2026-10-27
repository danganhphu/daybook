import type { Metadata } from "next";

import { PeopleSection } from "@/app/settings/people-section";
import { settingsCopy } from "@/app/settings/settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.people };

export const dynamic = "force-dynamic";

export default async function PeopleSettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, from] = await Promise.all([accountView(app, session), openedFrom(props)]);

  return <PeopleSection view={view} back={settingsPath(from)} />;
}
