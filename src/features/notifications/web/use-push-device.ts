"use client";

import { useSyncExternalStore } from "react";

import { useBrowserCapability } from "@/shared/web/use-browser-capability";
import { useHydrated } from "@/shared/web/use-hydrated";

import { permissionNow, supportsPush, watchPermission } from "./browser-push";

// Where this browser stands: no push at all, blocked by the person, never asked, or allowed. The server says whether
// this sign-in is subscribed; the browser says what it allows.
export type PushDevice = "unsupported" | "blocked" | "undecided" | "allowed";

function ignore(): () => void {
  return () => {};
}

function unknown(): undefined {
  return undefined;
}

// Undefined until hydrated: the server cannot know, and the first client render must match it
export function usePushDevice(): PushDevice | undefined {
  const hydrated = useHydrated();
  const supported = useBrowserCapability(supportsPush, false);
  const permission = useSyncExternalStore<NotificationPermission | undefined>(
    supported ? watchPermission : ignore,
    supported ? permissionNow : unknown,
    unknown,
  );

  if (!hydrated) {
    return undefined;
  }
  if (!supported) {
    return "unsupported";
  }

  switch (permission) {
    case "denied":
      return "blocked";
    case "granted":
      return "allowed";
    default:
      return "undecided";
  }
}
