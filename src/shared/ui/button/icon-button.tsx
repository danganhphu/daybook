import { Button as BaseButton } from "@base-ui/react/button";

import type { Icon } from "@/shared/ui/icon/icon";

import type { ButtonSize } from "./button";

import styles from "./button.module.scss";

// Quiet by default; primary is for the one action a screen exists for, such as sending. Never a filled red button.
type Appearance =
  | { readonly variant: "primary"; readonly tone?: "neutral" }
  | { readonly variant?: "quiet"; readonly tone?: "neutral" | "danger" };

export type IconButtonProps = Omit<
  BaseButton.Props,
  "className" | "style" | "children" | "aria-label"
> &
  Appearance & {
    readonly icon: Icon;
    // The accessible name; there is no visible text, so this is all a screen reader has
    readonly label: string;
    readonly size?: ButtonSize;
  };

export function IconButton({
  icon: Icon,
  label,
  variant = "quiet",
  tone = "neutral",
  size = "md",
  ...props
}: IconButtonProps) {
  return (
    <BaseButton
      {...props}
      aria-label={label}
      className={styles.button}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      data-icon-only=""
    >
      <Icon />
    </BaseButton>
  );
}
