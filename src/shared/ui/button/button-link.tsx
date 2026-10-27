import { AppLink, type AppLinkProps } from "@/shared/ui/app-link/app-link";

import type { ButtonSize } from "./button";

import styles from "./button.module.scss";

export type ButtonLinkProps = Omit<AppLinkProps, "className" | "style"> & {
  readonly variant?: "primary" | "secondary" | "quiet";
  readonly size?: ButtonSize;
};

// Looks like a Button, goes to another page or app (a tel: link dials): a real link, announced as one, no prefetch
// unless asked
export function ButtonLink({
  variant = "secondary",
  size = "md",
  prefetch = false,
  ...props
}: ButtonLinkProps) {
  return (
    <AppLink
      {...props}
      prefetch={prefetch}
      className={styles.button}
      data-variant={variant}
      data-tone="neutral"
      data-size={size}
    />
  );
}
