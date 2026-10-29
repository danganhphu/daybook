import type { Viewport } from "next";

import { DayScreen } from "@/app/(app)/_day/day-screen";
import { daybook, pushPublicKey } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { todaysNotes } from "@/features/notes/web/commands";
import { unreadNotifications } from "@/features/notifications/web/inbox-commands";
import { dayReadings } from "@/features/reading/web/commands";
import { dueReminders } from "@/features/reminders/web/commands";

// The notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

// On Android the keyboard shrinks the page, so the box stays just above it instead of under it
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default async function TodayPage() {
  const app = daybook();
  const session = await requireSession(app);

  const [view, due, readings, unread] = await Promise.all([
    todaysNotes(app),
    dueReminders(app),
    dayReadings(app, app.today()),
    unreadNotifications(app, session),
  ]);

  return (
    <DayScreen
      view={view}
      due={due}
      readings={readings}
      pushPublicKey={pushPublicKey()}
      unread={unread}
    />
  );
}
