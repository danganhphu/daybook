import type { ComponentProps } from "react";

import styles from "./text-area.module.scss";

export type TextAreaProps = Omit<ComponentProps<"textarea">, "className" | "style" | "rows">;

// Grows with what she types through `field-sizing: content`. Browsers without it keep three rows and scroll.
export function TextArea(props: TextAreaProps) {
  return <textarea rows={3} {...props} className={styles.textArea} />;
}
