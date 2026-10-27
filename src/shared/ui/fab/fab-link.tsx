import { AppLink } from "@/shared/ui/app-link/app-link";
import type { Icon } from "@/shared/ui/icon/icon";

import styles from "./fab-link.module.scss";

export type FabLinkProps = {
  readonly icon: Icon;
  // The accessible name; the icon is all a sighted user needs
  readonly label: string;
  readonly href: string;
};

// What a list screen adds to itself, as a round button floating over its foot
export function FabLink({ icon: Glyph, label, href }: FabLinkProps) {
  return (
    <AppLink href={href} className={styles.fab} aria-label={label} data-fab="">
      <Glyph aria-hidden />
    </AppLink>
  );
}
