import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { remindersScreen } from "@/features/reminders/web/commands";

import { RemindersScreen } from "./reminders-screen";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const app = daybook();
  await requireSession(app);

  return <RemindersScreen view={await remindersScreen(app)} />;
}
