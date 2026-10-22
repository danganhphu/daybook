import type { ReactNode } from "react";

import styles from "./access-panel.module.scss";

export type AccessFormProps = {
  // A form action: React runs it in a transition and resets the form afterwards
  readonly action: (form: FormData) => void | Promise<void>;
  readonly children: ReactNode;
};

// A form inside an AccessPanel: sign-in with the password, naming an invited account, the fallback password
export function AccessForm({ action, children }: AccessFormProps) {
  return (
    <form className={styles.form} action={action}>
      {children}
    </form>
  );
}
