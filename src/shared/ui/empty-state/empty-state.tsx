import type { ReactNode } from "react";

import styles from "./empty-state.module.scss";

export type EmptyStateProps = {
  // Says what is empty, not that something is
  readonly title: string;
  // One line on why, only when it helps
  readonly description?: string | undefined;
  // The action that fills it
  readonly action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className={styles.emptyState}>
      <h2 className={styles.title}>{title}</h2>
      {description === undefined ? null : <p className={styles.description}>{description}</p>}
      {action === undefined ? null : <div className={styles.action}>{action}</div>}
    </section>
  );
}
