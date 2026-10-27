import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "@/shared/ui/page-header/page-header";

import styles from "./screen.module.scss";

export type ScreenProps = Omit<PageHeaderProps, "title"> & {
  readonly title?: string | undefined;
  readonly children: ReactNode;
};

// The header, which sticks while the page scrolls, then one column of groups. Only a screen still loading has no title.
export function Screen({ title, subtitle, back, actions, children }: ScreenProps) {
  return (
    <main className={styles.page}>
      {title === undefined ? null : (
        <PageHeader title={title} subtitle={subtitle} back={back} actions={actions} />
      )}
      <div className={styles.column}>{children}</div>
    </main>
  );
}
