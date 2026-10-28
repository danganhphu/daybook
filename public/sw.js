// @ts-check
/// <reference lib="webworker" />
// Shows what the app pushes, and opens the app at the right screen when a notification is tapped. It has no fetch
// handler, so it never stands between the app and the network. Checked by `tsc -p tsconfig.sw.json`.

/**
 * @param {object} scope
 * @returns {scope is ServiceWorkerGlobalScope}
 */
function isServiceWorker(scope) {
  return "registration" in scope && "clients" in scope;
}

const scope = globalThis;
if (!isServiceWorker(scope)) {
  throw new Error("sw.js runs as a service worker only");
}
/** @type {ServiceWorkerGlobalScope} */
const worker = scope;

const appIcon = "/icons/icon-192.png";

/**
 * What the server sends (push-text.ts): the notification already in words, and where a tap goes
 * @typedef {{ title: string, body: string, tag: string, path: string }} PushMessage
 */

/**
 * @param {PushMessageData | null} data
 * @returns {PushMessage}
 */
function readMessage(data) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = data?.json();
  } catch {
    parsed = undefined;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "title" in parsed &&
    "body" in parsed &&
    "tag" in parsed &&
    "path" in parsed
  ) {
    const { title, body, tag, path } = parsed;
    if (
      typeof title === "string" &&
      typeof body === "string" &&
      typeof tag === "string" &&
      typeof path === "string"
    ) {
      return { title, body, tag, path };
    }
  }

  // Every push must show something; this one could not be read
  return { title: "daybook", body: "", tag: "unreadable", path: "/" };
}

/**
 * A path inside the app, never another origin
 * @param {unknown} path
 */
function inApp(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

worker.addEventListener("push", (event) => {
  const message = readMessage(event.data);
  event.waitUntil(
    worker.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: appIcon,
      data: { path: message.path },
    }),
  );
});

/** @param {string} path */
async function openApp(path) {
  const url = new URL(path, worker.location.origin).href;
  const [open] = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (open !== undefined) {
    try {
      await open.focus();
      await open.navigate(url);
      return;
    } catch {
      // A window this worker does not control cannot be sent anywhere; a new one can
    }
  }
  await worker.clients.openWindow(url);
}

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  /** @type {{ path?: unknown } | null} */
  const data = event.notification.data;
  event.waitUntil(openApp(inApp(data?.path)));
});
