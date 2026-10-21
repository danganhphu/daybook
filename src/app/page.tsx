import type { Viewport } from "next";

import { daybook } from "@/composition/daybook";
import { todaysNotes } from "@/features/notes/web/commands";

import { TodayScreen } from "./_today/today-screen";

// The notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

// On Android the keyboard shrinks the page, so the box stays just above it instead of under it
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default async function TodayPage() {
  const today = await todaysNotes(daybook());

  return <TodayScreen label={today.label} notes={today.notes} />;
}
