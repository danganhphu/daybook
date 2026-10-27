import { AppLink, type AppLinkProps } from "@/shared/ui/app-link/app-link";
import type { Icon } from "@/shared/ui/icon/icon";

import type { ButtonSize } from "./button";

import styles from "./button.module.scss";

export type IconLinkProps = Omit<
  AppLinkProps,
  "className" | "style" | "children" | "aria-label"
> & {
  readonly icon: Icon;
  // The accessible name; there is no visible text, so this is all a screen reader has
  readonly label: string;
  readonly size?: ButtonSize;
};

// Looks like a quiet icon button, but goes to another page: a real link, so a screen reader says so and it can open
// in a new tab. A Base UI button rendered as a link would be announced as a button. No prefetch unless asked: each
// one is a Worker request, and WebKit reports a cancelled one as a page error (traps, 2026-10-23).
export function IconLink({
  icon: Icon,
  label,
  size = "md",
  prefetch = false,
  ...props
}: IconLinkProps) {
  return (
    <AppLink
      {...props}
      prefetch={prefetch}
      aria-label={label}
      className={styles.button}
      data-variant="quiet"
      data-tone="neutral"
      data-size={size}
      data-icon-only=""
    >
      <Icon />
    </AppLink>
  );
}
