import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { searchNotes } from "@/features/notes/web/commands";
import { notesCopy } from "@/features/notes/web/notes-copy";
import { searchQueryParameter } from "@/shared/web/routes";

import { HistoryScreen } from "./history-screen";

export const metadata: Metadata = { title: notesCopy.search };

// Notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

type HistoryPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const app = daybook();
  await requireSession(app);

  // A repeated parameter is not something the form sends; it searches for nothing rather than guessing
  const query = (await searchParams)[searchQueryParameter];

  return <HistoryScreen view={await searchNotes(app, query)} />;
}
