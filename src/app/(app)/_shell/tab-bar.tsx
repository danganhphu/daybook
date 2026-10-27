"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type MouseEvent } from "react";

import { AppLink } from "@/shared/ui/app-link/app-link";
import { useToastClearance } from "@/shared/ui/toast/use-toast-clearance";

import { sections, type Section } from "./sections";
import { useTyping } from "./use-typing";

import styles from "./tab-bar.module.scss";

const tabs = Object.values(sections);

// The app's places. Hidden while the keyboard is up, so the box being typed in keeps the room.
export function TabBar() {
  const pathname = usePathname();
  const bar = useRef<HTMLElement>(null);
  useToastClearance(bar);
  const typing = useTyping();
  // Lit at the tap, not when the screen arrives
  const [tapped, setTapped] = useState<string>();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setTapped(undefined);
  }
  const shown = tapped ?? pathname;

  return (
    <nav
      ref={bar}
      className={styles.tabBar}
      aria-label="Mục chính"
      data-typing={typing ? "" : undefined}
    >
      <ul className={styles.list}>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Tab tab={tab} current={tab.owns(shown)} onTap={setTapped} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

type TabProps = {
  readonly tab: Section;
  readonly current: boolean;
  readonly onTap: (href: string) => void;
};

function Tab({ tab, current, onTap }: TabProps) {
  const Icon = tab.icon;
  const tap = useCallback(
    (event: MouseEvent) => {
      // A modified click opens a new tab and leaves this page where it is
      if (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        onTap(tab.href);
      }
    },
    [onTap, tab.href],
  );

  return (
    // No prefetch: each would render a whole screen on the server, and the screen in view stays until the next is ready
    <AppLink
      href={tab.href}
      prefetch={false}
      className={styles.tab}
      aria-current={current ? "page" : undefined}
      onClick={tap}
    >
      <span className={styles.indicator}>
        <Icon filled={current} />
      </span>
      <span className={styles.label}>{tab.label}</span>
    </AppLink>
  );
}
