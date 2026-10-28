import * as Sessions from "@/features/access/domain/session";
import type { Session } from "@/features/access/domain/session";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type { NotificationPreference } from "@/features/notifications/domain/notification-preference";
import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import type { PushSubscription } from "@/features/notifications/domain/push-subscription";
import type { PushSubscriptionRepository } from "@/features/notifications/domain/push-subscription-repository";
import type { Clock } from "@/shared/application/clock";

export type NotificationSettingsDeps = {
  readonly clock: Clock;
  readonly pushAvailable: boolean;
  readonly subscriptions: PushSubscriptionRepository;
  readonly preferences: NotificationPreferenceRepository;
};

export type NotifiedDevice = {
  readonly subscription: PushSubscription;
  // The browser asking
  readonly current: boolean;
};

export type NotificationSettings = {
  readonly pushAvailable: boolean;
  readonly preference: NotificationPreference;
  // Signed in and receiving, oldest first; a device whose sign-in ran out receives nothing and is not shown
  readonly devices: ReadonlyArray<NotifiedDevice>;
};

export async function notificationSettings(
  deps: NotificationSettingsDeps,
  session: Session,
): Promise<NotificationSettings> {
  const now = deps.clock();
  const [stored, devices] = await Promise.all([
    deps.preferences.get(session.accountId),
    deps.subscriptions.listWithSessions(session.accountId),
  ]);

  return {
    pushAvailable: deps.pushAvailable,
    preference: stored ?? NotificationPreferences.defaults(session.accountId),
    devices: devices
      .filter((device) => !Sessions.isExpired(device.session, now))
      .map(({ subscription }) => ({
        subscription,
        current: subscription.sessionId === session.id,
      })),
  };
}
