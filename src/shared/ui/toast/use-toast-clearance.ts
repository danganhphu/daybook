import { useEffect, type RefObject } from "react";

// A bar docked at the bottom of the screen, such as a message box, calls this so toasts appear above it instead of
// over it. It publishes the bar's height as --toast-clearance on the root, and follows it as the bar grows.
export function useToastClearance(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        root.style.setProperty(
          "--toast-clearance",
          `${entry.target.getBoundingClientRect().height}px`,
        );
      }
    });

    if (bar.current !== null) {
      observer.observe(bar.current);
    }

    return () => {
      observer.disconnect();
      root.style.removeProperty("--toast-clearance");
    };
  }, [bar]);
}
