"use client";

import { useSyncExternalStore } from "react";

// What a browser can do does not change while the page is open, so there is nothing to subscribe to
function subscribe() {
  return () => {};
}

// Whether this browser has a feature. The server cannot know, so it renders with `onServer`, and the first client
// render corrects it without a hydration mismatch.
export function useBrowserCapability(check: () => boolean, onServer: boolean): boolean {
  return useSyncExternalStore(subscribe, check, () => onServer);
}
