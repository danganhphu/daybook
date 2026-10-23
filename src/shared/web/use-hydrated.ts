"use client";

import { useBrowserCapability } from "./use-browser-capability";

function always() {
  return true;
}

// Whether React has taken over the page. Until then no handler is attached: a tap on a button is lost, and a submit
// button would send its form the browser's way, reloading the page.
export function useHydrated(): boolean {
  return useBrowserCapability(always, false);
}
