import type { ReactNode } from "react";

import styles from "./screen.module.scss";

export type ScreenProps = {
  // The faint green at the top: only a tab's own screen has it
  readonly wash?: boolean;
  readonly children: ReactNode;
};

// The column every list-and-detail screen sits in: the content width, the side gutters, room at the bottom for the
// thumb, and the same gap between its groups. The page behind it spans the whole width, so the wash does too.
export function Screen({ wash = false, children }: ScreenProps) {
  return (
    <main className={styles.page} data-wash={wash ? "" : undefined}>
      <div className={styles.column}>{children}</div>
    </main>
  );
}
