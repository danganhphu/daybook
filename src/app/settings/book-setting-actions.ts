"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as BookSettings from "@/features/book-settings/web/book-setting-commands";
import type { Result } from "@/shared/domain/result";

// Settings > Khách lâu không đặt. The book's data, not its security, so no step-up. A change refreshes the screen, so it
// shows what is stored now and the version to send next.
export async function saveQuietAfterDays(
  days: unknown,
  version: unknown,
): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const saved = await BookSettings.saveQuietAfterDays(app, session.accountId, days, version);
  if (saved.ok) {
    refresh();
  }

  return saved;
}
