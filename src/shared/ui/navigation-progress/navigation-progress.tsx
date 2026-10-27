"use client";

import { useSyncExternalStore } from "react";

import { isNavigating, subscribeToNavigations } from "@/shared/web/navigation-pending";

import styles from "./navigation-progress.module.scss";

const notOnServer = () => false;

// A thin bar along the top while the next screen is on its way. The screen in view stays until then, and the bar shows
// only past a second, so a quick navigation shows nothing (docs/ui/design-system.md).
export function NavigationProgress() {
  const active = useSyncExternalStore(subscribeToNavigations, isNavigating, notOnServer);

  return (
    <div className={styles.progress} data-active={active ? "" : undefined}>
      {/* What a screen reader finds; the bars are drawn beside it, since a progress element cannot hold them */}
      <progress className={styles.native} aria-label="Đang tải trang" />
      <div aria-hidden className={styles.primary}>
        <div className={styles.inner} />
      </div>
      <div aria-hidden className={styles.secondary}>
        <div className={styles.inner} />
      </div>
    </div>
  );
}
