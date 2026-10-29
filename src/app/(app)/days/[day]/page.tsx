import { notFound, redirect } from "next/navigation";
import { Temporal } from "temporal-polyfill/implementation";

import { DayScreen } from "@/app/(app)/_day/day-screen";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { dayNotes } from "@/features/notes/web/commands";
import { unreadNotifications } from "@/features/notifications/web/inbox-commands";
import { dayReadings } from "@/features/reading/web/commands";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { routes } from "@/shared/web/routes";

// Notes change with every visit; never prerender this page
export const dynamic = "force-dynamic";

type DayPageProps = { readonly params: Promise<{ readonly day: string }> };

// An earlier day. Today lives at the home screen, and a day that has not come yet holds nothing, so both go there;
// text that is not a real day is a page that does not exist.
export default async function DayPage({ params }: DayPageProps) {
  const app = daybook();
  const session = await requireSession(app);

  const day = calendarDaySchema.safeParse((await params).day);
  if (!day.success) {
    notFound();
  }
  if (Temporal.PlainDate.compare(day.data, app.today()) >= 0) {
    redirect(routes.today);
  }

  const [view, readings, unread] = await Promise.all([
    dayNotes(app, day.data),
    dayReadings(app, day.data),
    unreadNotifications(app, session),
  ]);

  return <DayScreen view={view} readings={readings} unread={unread} />;
}
