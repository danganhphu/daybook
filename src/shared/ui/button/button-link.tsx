import Link from "next/link";
import type { ComponentProps } from "react";

import type { ButtonSize } from "./button";

import styles from "./button.module.scss";

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className" | "style"> & {
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
    <Link
      {...props}
      prefetch={prefetch}
      className={styles.button}
      data-variant={variant}
      data-tone="neutral"
      data-size={size}
    />
  );
}
