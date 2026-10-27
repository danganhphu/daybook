import type { Metadata } from "next";

import { knownTab } from "@/app/(app)/_shell/sections";
import { daybook } from "@/composition/daybook";
import { toAccountView } from "@/features/access/web/account-view";
import { requireSession } from "@/features/access/web/session-gate";
import { kindsView } from "@/features/customers/web/commands";
import { settingsFromParameter } from "@/shared/web/routes";

import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = { title: "Cài đặt", robots: { index: false, follow: false } };

// Devices and activity change with every visit
export const dynamic = "force-dynamic";

type SettingsPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [overview, kinds, query] = await Promise.all([
    app.accountOverview(session.accountId),
    kindsView(app),
    searchParams,
  ]);
  const from = query[settingsFromParameter];

  return (
    <SettingsScreen
      view={toAccountView(overview, session.id)}
      kinds={kinds}
      back={knownTab(typeof from === "string" ? from : undefined)}
    />
  );
}
