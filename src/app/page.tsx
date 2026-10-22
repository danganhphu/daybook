import type { Viewport } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { todaysNotes } from "@/features/notes/web/commands";

import { TodayScreen } from "./_today/today-screen";

// The notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

// On Android the keyboard shrinks the page, so the box stays just above it instead of under it
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default async function TodayPage() {
  const app = daybook();
  await requireSession(app);
  const today = await todaysNotes(app);

  return <TodayScreen label={today.label} notes={today.notes} />;
}
