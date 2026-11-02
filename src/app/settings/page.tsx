import type { Metadata } from "next";

import { daybook, telegramAvailable } from "@/composition/daybook";
import { accessCopy } from "@/features/access/web/access-copy";
import { requireSession } from "@/features/access/web/session-gate";
import { kindsView } from "@/features/customers/web/commands";

import { settingsCopy, telegramLinkedAs } from "./settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "./settings-data";
import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = {
  title: accessCopy.settings,
  robots: { index: false, follow: false },
};

// Devices and activity change with every visit
export const dynamic = "force-dynamic";

export default async function SettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const botConfigured = telegramAvailable();
  const [view, kinds, from, link] = await Promise.all([
    accountView(app, session),
    kindsView(app),
    openedFrom(props),
    botConfigured ? app.telegramLink(session.accountId) : undefined,
  ]);
  // No row at all where there is no bot
  const telegram = botConfigured
    ? link === undefined
      ? settingsCopy.telegramNotLinked
      : telegramLinkedAs(link.telegramName)
    : undefined;

  return <SettingsScreen view={view} kinds={kinds} from={from} telegram={telegram} />;
}
