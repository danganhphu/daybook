import type { ComponentProps } from "react";

import styles from "./text-area.module.scss";

export type TextAreaProps = Omit<ComponentProps<"textarea">, "className" | "style" | "rows"> & {
  // `bare` drops the border and focus ring for a box that sits inside a field drawing its own, such as the message
  // field; that field must show focus with :focus-within
  readonly appearance?: "boxed" | "bare";
};

// Grows with what is typed through `field-sizing: content`. Browsers without it keep three rows and scroll.
export function TextArea({ appearance = "boxed", ...props }: TextAreaProps) {
  return <textarea rows={3} {...props} className={styles.textArea} data-appearance={appearance} />;
}
