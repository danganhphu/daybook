"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requestOrigin } from "@/features/access/web/request-context";
import { requireSession } from "@/features/access/web/session-gate";
import * as Notifications from "@/features/notifications/web/notification-commands";
import type { NotificationTimesView } from "@/features/notifications/web/notification-view";
import type { Result } from "@/shared/domain/result";

// Settings > Thông báo. Not security settings, so no step-up; each still checks the session. Changes from the screen
// refresh it, so its device list shows what is stored now.

function refreshed<T>(result: Result<T, string>): Result<T, string> {
  if (result.ok) {
    refresh();
  }

  return result;
}

export async function turnOnPush(subscription: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Notifications.turnOn(app, session, subscription, await requestOrigin()));
}

// The same, after a sign-in or a step-up moved this browser to a new session: nothing on screen changes, so nothing
// is rendered again
export async function reattachPush(subscription: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return Notifications.turnOn(app, session, subscription, await requestOrigin());
}

export async function turnOffPush(subscriptionId: unknown): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(
    await Notifications.turnOff(app, session, subscriptionId, await requestOrigin()),
  );
}

export async function saveNotificationTimes(
  times: unknown,
): Promise<Result<NotificationTimesView, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Notifications.saveTimes(app, session, times));
}
