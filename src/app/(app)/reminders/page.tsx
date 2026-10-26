import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { doneReminders, remindersScreen } from "@/features/reminders/web/commands";
import { remindersQuery } from "@/features/reminders/web/reminders-path";

import { RemindersScreen } from "./reminders-screen";

export const dynamic = "force-dynamic";

type RemindersPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function RemindersPage({ searchParams }: RemindersPageProps) {
  const app = daybook();
  await requireSession(app);
  const params = await searchParams;
  const showingDone = params[remindersQuery.view] === remindersQuery.doneView;

  const [open, done] = await Promise.all([
    remindersScreen(app),
    showingDone ? doneReminders(app, { after: params[remindersQuery.after] }) : undefined,
  ]);

  return <RemindersScreen view={open} done={done} />;
}
