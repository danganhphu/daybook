"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useToastClearance } from "@/shared/ui/toast/use-toast-clearance";

import { sections } from "./sections";
import { useTyping } from "./use-typing";

import styles from "./tab-bar.module.scss";

const tabs = Object.values(sections);

// The app's places, as ColorOS's floating tab bar. Hidden while the keyboard is up, so the box being typed in keeps
// the room.
export function TabBar() {
  const pathname = usePathname();
  const bar = useRef<HTMLElement>(null);
  useToastClearance(bar);
  const typing = useTyping();

  return (
    <nav
      ref={bar}
      className={styles.tabBar}
      aria-label="Mục chính"
      data-typing={typing ? "" : undefined}
    >
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const current = tab.owns(pathname);

          return (
            <li key={tab.href}>
              {/* No prefetch: a tab is a Worker request and D1 reads that most visits never use */}
              <Link
                href={tab.href}
                prefetch={false}
                className={styles.tab}
                aria-current={current ? "page" : undefined}
              >
                {/* Filled where you are, outlined elsewhere, as ColorOS and Material mark the current tab */}
                <Icon filled={current} />
                <span className={styles.label}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
