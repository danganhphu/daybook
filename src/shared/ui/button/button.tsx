import { Button as BaseButton } from "@base-ui/react/button";

import styles from "./button.module.scss";

// Destructive actions never take the filled green style, so primary has no danger tone
type Appearance =
  | { readonly variant: "primary"; readonly tone?: "neutral" }
  | { readonly variant?: "secondary" | "quiet"; readonly tone?: "neutral" | "danger" };

export type ButtonSize = "md" | "lg";

export type ButtonProps = Omit<BaseButton.Props, "className" | "style"> &
  Appearance & {
    readonly size?: ButtonSize;
  };

export function Button({
  variant = "secondary",
  tone = "neutral",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      className={styles.button}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
    />
  );
}
