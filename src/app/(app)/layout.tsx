import type { ReactNode } from "react";

import { TabBar } from "./_shell/tab-bar";

import styles from "./_shell/app-shell.module.scss";

// Every signed-in screen sits in this frame: the page, and the tab bar to the app's other places
export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.page}>{children}</div>
      <div className={styles.tabs}>
        <TabBar />
      </div>
    </div>
  );
}
