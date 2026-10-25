import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
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
  await requireSession(app);

  return <ReportsScreen view={await reportsScreen(app, await searchParams)} />;
}
