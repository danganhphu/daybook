import { Button as BaseButton } from "@base-ui/react/button";
import type { LucideIcon } from "lucide-react";

import type { ButtonSize } from "./button";

import styles from "./button.module.scss";

export type IconButtonProps = Omit<
  BaseButton.Props,
  "className" | "style" | "children" | "aria-label"
> & {
  readonly icon: LucideIcon;
  // The accessible name; there is no visible text, so this is all a screen reader has
  readonly label: string;
  readonly tone?: "neutral" | "danger";
  readonly size?: ButtonSize;
};

export function IconButton({
  icon: Icon,
  label,
  tone = "neutral",
  size = "md",
  ...props
}: IconButtonProps) {
  return (
    <BaseButton
      {...props}
      aria-label={label}
      className={styles.button}
      data-variant="quiet"
      data-tone={tone}
      data-size={size}
      data-icon-only=""
    >
      <Icon />
    </BaseButton>
  );
}
