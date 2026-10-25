import type { ReactNode } from "react";

import styles from "./list.module.scss";

export type ListProps = {
  // What the rows have in common, e.g. "Thiết bị"
  readonly heading?: string | undefined;
  // One line under the card, when the rows need it explained
  readonly footer?: string | undefined;
  // ListRow, ListAction and ListContent
  readonly children: ReactNode;
};

// Rows grouped in one card, as the phone's own settings are
export function List({ heading, footer, children }: ListProps) {
  return (
    <section className={styles.section}>
      {heading === undefined ? null : <h2 className={styles.heading}>{heading}</h2>}
      <ul className={styles.list}>{children}</ul>
      {footer === undefined ? null : <p className={styles.footer}>{footer}</p>}
    </section>
  );
}
