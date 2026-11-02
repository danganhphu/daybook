import type { Session } from "@/features/access/domain/session";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { Version } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { ChangeNotificationTimesDeps } from "./change-notification-times";
import type { NotificationError } from "./notification-errors";

export type ChangeNotificationTelegramInput = {
  readonly on: boolean;
  // The version the screen showed; undefined when it showed the defaults
  readonly shown: Version | undefined;
};

// Whether a person's notifications also go to their Telegram. Not a security setting: the notices about their sign-in
// still reach the list in the app and every browser with push on.
export async function changeNotificationTelegram(
  deps: ChangeNotificationTimesDeps,
  session: Session,
  input: ChangeNotificationTelegramInput,
): Promise<
  Result<NotificationPreference, Extract<NotificationError, "telegram_changed_elsewhere">>
> {
  const stored = await deps.preferences.get(session.accountId);
  const current = stored ?? NotificationPreferences.defaults(session.accountId);
  if (!NotificationPreferences.isCurrent(current, input.shown)) {
    return err("telegram_changed_elsewhere");
  }

  const changed = NotificationPreferences.changeTelegram(
    current,
    input.on,
    session.accountId,
    deps.clock(),
  );
  const work = deps.startUnitOfWork();
  if (stored === undefined) {
    work.notificationPreferences.add(changed);
  } else {
    work.notificationPreferences.update(changed);
  }

  return (await commitUnlessStale(work)) === "stale"
    ? err("telegram_changed_elsewhere")
    : ok(changed);
}
