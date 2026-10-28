import type { Session } from "@/features/access/domain/session";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type {
  NotificationPreference,
  NotificationTimes,
} from "@/features/notifications/domain/notification-preference";
import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import type { Clock } from "@/shared/application/clock";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { Version } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NotificationError } from "./notification-errors";
import type { NotificationPreferenceWrites } from "./notification-writes";

export type ChangeNotificationTimesDeps = {
  readonly clock: Clock;
  readonly preferences: NotificationPreferenceRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly notificationPreferences: NotificationPreferenceWrites;
  }>;
};

export type ChangeNotificationTimesInput = {
  readonly times: NotificationTimes;
  // The version the screen showed; undefined when it showed the defaults
  readonly shown: Version | undefined;
};

// A person's own times. Not a security setting: nothing changes about who can read what.
export async function changeNotificationTimes(
  deps: ChangeNotificationTimesDeps,
  session: Session,
  input: ChangeNotificationTimesInput,
): Promise<Result<NotificationPreference, Extract<NotificationError, "times_changed_elsewhere">>> {
  const stored = await deps.preferences.get(session.accountId);
  const current = stored ?? NotificationPreferences.defaults(session.accountId);
  if (!NotificationPreferences.isCurrent(current, input.shown)) {
    return err("times_changed_elsewhere");
  }

  const changed = NotificationPreferences.change(
    current,
    input.times,
    session.accountId,
    deps.clock(),
  );
  const work = deps.startUnitOfWork();
  if (stored === undefined) {
    work.notificationPreferences.add(changed);
  } else {
    work.notificationPreferences.update(changed);
  }

  return (await commitUnlessStale(work)) === "stale" ? err("times_changed_elsewhere") : ok(changed);
}
