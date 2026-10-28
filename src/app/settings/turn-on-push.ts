import {
  heldSubscription,
  subscribeThisBrowser,
  supportsPush,
} from "@/features/notifications/web/browser-push";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { attempt } from "@/shared/web/attempt";

import { reattachPush, turnOnPush } from "./notification-actions";

// Turns notifications on for this browser, from a tap: Settings' switch and the offer on Hôm nay. What to tell the
// person, or undefined when there is nothing to say: permission was refused, or Chrome's prompt closed on its own,
// and the screen already shows that.
export async function turnOnHere(publicKey: string): Promise<string | undefined> {
  let subscription;
  try {
    subscription = await subscribeThisBrowser(publicKey);
  } catch {
    return notificationsCopy.notTurnedOn;
  }
  if (subscription === undefined) {
    return undefined;
  }
  const saved = await attempt(() => turnOnPush(subscription));

  return saved.ok ? notificationsCopy.turnedOn : saved.error;
}

// After a sign-in or a step-up: a browser that had notifications on keeps them under its new session. Quiet whatever
// happens; Settings shows the state if it did not work.
export async function keepPushOn(): Promise<void> {
  if (!supportsPush() || Notification.permission !== "granted") {
    return;
  }
  try {
    const held = await heldSubscription();
    if (held !== undefined) {
      await attempt(() => reattachPush(held));
    }
  } catch {
    // Nothing to tell: the person did not ask for this
  }
}
