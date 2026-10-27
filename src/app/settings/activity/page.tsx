import type { Metadata } from "next";

import { settingsCopy } from "@/app/settings/settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { List } from "@/shared/ui/list/list";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.activity };

export const dynamic = "force-dynamic";

export default async function ActivitySettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, from] = await Promise.all([accountView(app, session), openedFrom(props)]);

  return (
    <Screen title={settingsCopy.activity} back={settingsPath(from)}>
      <List>
        {view.activity.map((event) => (
          <ListRow key={event.id} title={event.title} detail={event.detail} />
        ))}
      </List>
    </Screen>
  );
}
