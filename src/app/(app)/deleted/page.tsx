import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { deletedNotes } from "@/features/notes/web/commands";
import { deletedOrders } from "@/features/orders/web/commands";
import { deletedReminders } from "@/features/reminders/web/commands";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

import { DeletedScreen } from "./deleted-screen";

export const metadata: Metadata = { title: recentlyDeletedCopy.title };

// Deleting and restoring happen on every other screen
export const dynamic = "force-dynamic";

export default async function DeletedPage() {
  const app = daybook();
  await requireSession(app);
  const people = await app.displayNames();
  const [orders, notes, reminders] = await Promise.all([
    deletedOrders(app, people),
    deletedNotes(app, people),
    deletedReminders(app, people),
  ]);

  return <DeletedScreen orders={orders} notes={notes} reminders={reminders} />;
}
