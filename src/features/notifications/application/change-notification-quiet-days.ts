import type { Session } from "@/features/access/domain/session";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import type { QuietAfterDays } from "@/features/reports/domain/gone-quiet";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { Version } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { ChangeNotificationTimesDeps } from "./change-notification-times";
import type { NotificationError } from "./notification-errors";

export type ChangeNotificationQuietDaysInput = {
  readonly days: QuietAfterDays;
  // The version the screen showed; undefined when it showed the defaults
  readonly shown: Version | undefined;
};

// A person's own number of days for the customers their notifications name; the report has its own
export async function changeNotificationQuietDays(
  deps: ChangeNotificationTimesDeps,
  session: Session,
  input: ChangeNotificationQuietDaysInput,
): Promise<Result<NotificationPreference, Extract<NotificationError, "days_changed_elsewhere">>> {
  const stored = await deps.preferences.get(session.accountId);
  const current = stored ?? NotificationPreferences.defaults(session.accountId);
  if (!NotificationPreferences.isCurrent(current, input.shown)) {
    return err("days_changed_elsewhere");
  }

  const changed = NotificationPreferences.changeQuietAfterDays(
    current,
    input.days,
    session.accountId,
    deps.clock(),
  );
  const work = deps.startUnitOfWork();
  if (stored === undefined) {
    work.notificationPreferences.add(changed);
  } else {
    work.notificationPreferences.update(changed);
  }

  return (await commitUnlessStale(work)) === "stale" ? err("days_changed_elsewhere") : ok(changed);
}
