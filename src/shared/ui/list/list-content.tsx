import type { ReactNode } from "react";

import styles from "./list.module.scss";

// A row given over to something larger than a title, such as a field being edited in place
export function ListContent({ children }: { readonly children: ReactNode }) {
  return <li className={styles.content}>{children}</li>;
}
