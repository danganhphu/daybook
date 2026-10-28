import { routes } from "@/shared/web/routes";

import type { BrowserSubscription } from "./notification-view";

// The browser's side of push: the service worker, the permission, the subscription. No library and no Zod, so the
// screens that use it stay light; the server checks what it is handed.

export function supportsPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function permissionNow(): NotificationPermission {
  return Notification.permission;
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(routes.serviceWorker, {
    scope: "/",
    updateViaCache: "none",
  });

  return navigator.serviceWorker.ready;
}

function handedOver(subscription: PushSubscription): BrowserSubscription | undefined {
  const { endpoint, keys } = subscription.toJSON();
  const p256dh = keys?.["p256dh"];
  const auth = keys?.["auth"];

  return endpoint === undefined || p256dh === undefined || auth === undefined
    ? undefined
    : { endpoint, keys: { p256dh, auth } };
}

// What this browser already holds, without registering anything
export async function heldSubscription(): Promise<BrowserSubscription | undefined> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();

  return subscription === undefined || subscription === null ? undefined : handedOver(subscription);
}

// Asks for permission, then subscribes. Called first thing from a tap: browsers want the request to follow one.
// Undefined when permission was not given - refused, or Chrome's prompt closed on its own (Chrome 155 and later).
export async function subscribeThisBrowser(
  publicKey: string,
): Promise<BrowserSubscription | undefined> {
  if ((await Notification.requestPermission()) !== "granted") {
    return undefined;
  }
  const registration = await serviceWorker();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    }));

  return handedOver(subscription);
}

export async function unsubscribeThisBrowser(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
}

// Tells when the permission changes while the page is open: Chrome lets someone allow notifications later from the
// site's settings, after its prompt closed without an answer
export function watchPermission(onChange: () => void): () => void {
  let status: PermissionStatus | undefined;
  let stopped = false;
  void (async () => {
    try {
      status = await navigator.permissions.query({ name: "notifications" });
    } catch {
      // A browser that cannot be asked about this permission: the page shows what it saw on load
      return;
    }
    if (!stopped) {
      status.addEventListener("change", onChange);
    }
  })();

  return () => {
    stopped = true;
    status?.removeEventListener("change", onChange);
  };
}
