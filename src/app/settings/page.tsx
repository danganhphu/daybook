import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { toAccountView } from "@/features/access/web/account-view";
import { requireSession } from "@/features/access/web/session-gate";
import { kindsView } from "@/features/customers/web/commands";

import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = { title: "Cài đặt", robots: { index: false, follow: false } };

// Devices and activity change with every visit
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const app = daybook();
  const session = await requireSession(app);
  const [overview, kinds] = await Promise.all([
    app.accountOverview(session.accountId),
    kindsView(app),
  ]);

  return <SettingsScreen view={toAccountView(overview, session.id)} kinds={kinds} />;
}
