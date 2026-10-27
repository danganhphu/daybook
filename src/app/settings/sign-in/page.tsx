import type { Metadata } from "next";

import { settingsCopy } from "@/app/settings/settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { SignInSection } from "@/app/settings/sign-in-section";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.signInMethods };

export const dynamic = "force-dynamic";

export default async function SignInSettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, from] = await Promise.all([accountView(app, session), openedFrom(props)]);

  return <SignInSection view={view} back={settingsPath(from)} />;
}
