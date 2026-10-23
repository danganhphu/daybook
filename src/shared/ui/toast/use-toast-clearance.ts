import { useEffect, type RefObject } from "react";

// Bars docked at the bottom of the screen - the tab bar, the message box above it - call this so toasts appear above
// them instead of over them. Each publishes how far its top edge sits from the bottom of the window; the root's
// --toast-clearance is the largest, so the toast clears every bar at once.
const clearances = new Map<Element, number>();

function publish() {
  const root = document.documentElement;
  if (clearances.size === 0) {
    root.style.removeProperty("--toast-clearance");
    return;
  }

  root.style.setProperty("--toast-clearance", `${Math.max(...clearances.values())}px`);
}

function measure(element: Element) {
  const { top, height } = element.getBoundingClientRect();
  // Not docked at the bottom: hidden while the keyboard is up, or standing down the side as the tab bar does from `md`
  const docked = height > 0 && top > window.innerHeight / 2;
  clearances.set(element, docked ? window.innerHeight - top : 0);
  publish();
}

export function useToastClearance(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = bar.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measure(entry.target);
      }
    });
    if (element !== null) {
      observer.observe(element);
      measure(element);
    }

    return () => {
      observer.disconnect();
      if (element !== null) {
        clearances.delete(element);
      }
      publish();
    };
  }, [bar]);
}
