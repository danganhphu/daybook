import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { trashScreen } from "@/features/trash/web/commands";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

import { DeletedScreen } from "./deleted-screen";

export const metadata: Metadata = { title: recentlyDeletedCopy.title };

// Deleting and restoring happen on every other screen
export const dynamic = "force-dynamic";

export default async function DeletedPage() {
  const app = daybook();
  await requireSession(app);

  return <DeletedScreen rows={await trashScreen(app)} />;
}
