import type { ReactNode } from "react";

import styles from "./notice.module.scss";

export type NoticeProps = {
  // What state the record is in: deleted, hidden, merged
  readonly message: string;
  // Danger when the record is gone from where it belongs, such as a deleted order
  readonly tone?: "muted" | "danger";
  // The way back or onward, beside the message: a button or a link
  readonly children?: ReactNode;
};

// A record's state, said first on its page, before anything else on it
export function Notice({ message, tone = "muted", children }: NoticeProps) {
  return (
    <div className={styles.notice} data-tone={tone}>
      <p>{message}</p>
      {children}
    </div>
  );
}
