import type { Viewport } from "next";

import { DayScreen } from "@/app/(app)/_day/day-screen";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { todaysNotes } from "@/features/notes/web/commands";

// The notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

// On Android the keyboard shrinks the page, so the box stays just above it instead of under it
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default async function TodayPage() {
  const app = daybook();
  await requireSession(app);

  return <DayScreen view={await todaysNotes(app)} />;
}
