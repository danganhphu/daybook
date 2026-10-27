import { useEffect } from "react";

// Enough for Face ID and the answer to reach the server before the prompt runs out there
const marginMs = 30_000;

// A prompt held for the next tap lives on the server only as long as its timeout. A new one is fetched before then, or
// as soon as the page is seen again if it was left open longer, so the tap after a long pause does not fail.
export function usePromptRefresh(
  options: { readonly timeout?: number } | undefined,
  refresh: () => void,
): void {
  useEffect(() => {
    const timeout = options?.timeout;
    if (timeout === undefined) {
      return undefined;
    }

    const staleAt = Date.now() + timeout - marginMs;
    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() >= staleAt) {
        refresh();
      }
    };
    const timer = setTimeout(refreshIfStale, staleAt - Date.now());
    document.addEventListener("visibilitychange", refreshIfStale);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [options, refresh]);
}
