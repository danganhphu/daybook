import { z } from "zod";

import type { App } from "@/composition/create-app";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import { formatMoment } from "@/features/access/web/account-view";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import { timeOfDaySchema } from "@/features/notifications/domain/notification-preference";
import {
  pushEndpointSchema,
  pushKeysSchema,
} from "@/features/notifications/domain/push-subscription";
import { versionSchema } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { NotificationTimesView, NotificationsView } from "./notification-view";
import { notificationErrorMessages, notificationsCopy } from "./notifications-copy";

// What Settings > Thông báo does for each request, minus the framework. A refusal is the sentence to show.

const subscriptionInput = z.object({ endpoint: pushEndpointSchema, keys: pushKeysSchema });

const timesInput = z.object({
  morningAt: timeOfDaySchema.nullable(),
  weeklyAt: timeOfDaySchema.nullable(),
  version: versionSchema.nullable(),
});

function timesView(preference: NotificationPreference): NotificationTimesView {
  return {
    morningAt: preference.morningAt,
    weeklyAt: preference.weeklyAt,
    version: preference.audit?.version,
  };
}

export async function notificationsView(
  app: App,
  session: Session,
  publicKey: string | undefined,
): Promise<NotificationsView> {
  const settings = await app.notificationSettings(session);

  return {
    ...timesView(settings.preference),
    available: settings.pushAvailable && publicKey !== undefined,
    publicKey,
    thisDevice: settings.devices.find((device) => device.current)?.subscription.id,
    devices: settings.devices.map(({ subscription, current }) => ({
      id: subscription.id,
      title: subscription.deviceLabel,
      detail: current
        ? notificationsCopy.thisDevice
        : subscription.lastSentAt === undefined
          ? notificationsCopy.neverSent
          : `${notificationsCopy.lastSent} ${formatMoment(subscription.lastSentAt)}`,
      current,
    })),
  };
}

export async function turnOn(
  app: App,
  session: Session,
  subscription: unknown,
  origin: RequestOrigin,
): Promise<Result<null, string>> {
  const parsed = subscriptionInput.safeParse(subscription);
  if (!parsed.success) {
    return err(notificationErrorMessages.push_service_unknown);
  }
  const subscribed = await app.subscribeDevice(session, parsed.data, origin);
  if (!subscribed.ok) {
    if (subscribed.error === "push_service_unknown") {
      // The host only, to see when a browser starts handing out a new one; the rest is the browser's capability
      console.error(
        JSON.stringify({
          event: "push_service_unknown",
          host: new URL(parsed.data.endpoint).host,
        }),
      );
    }
    return err(notificationErrorMessages[subscribed.error]);
  }

  return ok(null);
}

export async function turnOff(
  app: App,
  session: Session,
  subscriptionId: unknown,
  origin: RequestOrigin,
): Promise<Result<null, string>> {
  const removed = await app.unsubscribeDevice(session, subscriptionId, origin);

  return removed.ok ? ok(null) : err(notificationErrorMessages[removed.error]);
}

export async function saveTimes(
  app: App,
  session: Session,
  times: unknown,
): Promise<Result<NotificationTimesView, string>> {
  const parsed = timesInput.safeParse(times);
  // The screen offers only valid times, so a refusal here is not someone's typing
  if (!parsed.success) {
    return err(notificationsCopy.invalidTimes);
  }
  const changed = await app.changeNotificationTimes(session, {
    times: {
      morningAt: parsed.data.morningAt ?? undefined,
      weeklyAt: parsed.data.weeklyAt ?? undefined,
    },
    shown: parsed.data.version ?? undefined,
  });

  return changed.ok ? ok(timesView(changed.value)) : err(notificationErrorMessages[changed.error]);
}
