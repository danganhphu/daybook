import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { accessCopy } from "@/features/access/web/access-copy";
import { requireSession } from "@/features/access/web/session-gate";
import { kindsView } from "@/features/customers/web/commands";

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
  const [view, kinds, from] = await Promise.all([
    accountView(app, session),
    kindsView(app),
    openedFrom(props),
  ]);

  return <SettingsScreen view={view} kinds={kinds} from={from} />;
}
