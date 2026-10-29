import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { unreadNotifications } from "@/features/notifications/web/inbox-commands";
import { reportsScreen } from "@/features/reports/web/commands";
import { reportsCopy } from "@/features/reports/web/reports-copy";

import { ReportsScreen } from "./reports-screen";

export const metadata: Metadata = { title: reportsCopy.title };

// The figures change with every order and payment
export const dynamic = "force-dynamic";

type ReportsPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const [view, unread] = await Promise.all([
    reportsScreen(app, await searchParams),
    unreadNotifications(app, session),
  ]);

  return <ReportsScreen view={view} unread={unread} />;
}
