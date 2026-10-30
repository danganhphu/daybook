"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Trash from "@/features/trash/web/commands";
import type { TrashOutcomeView } from "@/features/trash/web/commands";
import type { Result } from "@/shared/domain/result";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument. Each
// also undoes a delete from its toast, wherever that delete was.

export async function restoreFromTrash(items: unknown): Promise<Result<TrashOutcomeView, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Trash.restoreFromTrash(app, session.accountId, items);
  refresh();

  return result;
}

export async function purgeFromTrash(items: unknown): Promise<Result<TrashOutcomeView, string>> {
  const app = daybook();
  await requireSession(app);
  const result = await Trash.purgeFromTrash(app, items);
  refresh();

  return result;
}
