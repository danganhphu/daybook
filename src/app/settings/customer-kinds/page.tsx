import type { Metadata } from "next";

import { CustomerKinds } from "@/app/settings/customer-kinds";
import { settingsCopy } from "@/app/settings/settings-copy";
import { openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { kindsView } from "@/features/customers/web/commands";
import { Screen } from "@/shared/ui/screen/screen";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.kinds };

export const dynamic = "force-dynamic";

export default async function CustomerKindsSettingsPage(props: SettingsPageProps) {
  const app = daybook();
  await requireSession(app);
  const [kinds, from] = await Promise.all([kindsView(app), openedFrom(props)]);

  return (
    <Screen title={settingsCopy.kinds} back={settingsPath(from)}>
      <CustomerKinds kinds={kinds} />
    </Screen>
  );
}
