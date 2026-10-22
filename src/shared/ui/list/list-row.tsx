import type { ReactNode } from "react";

import styles from "./list.module.scss";

export type ListRowProps = {
  readonly title: string;
  // The one value that tells two rows apart: a time, a device, a state
  readonly detail?: string | undefined;
  // What can be done to this row, at its end: a quiet button or an ActionMenu
  readonly children?: ReactNode;
};

export function ListRow({ title, detail, children }: ListRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {detail === undefined ? null : <p className={styles.detail}>{detail}</p>}
      </div>
      {children}
    </li>
  );
}
