import { AppLink } from "@/shared/ui/app-link/app-link";

import styles from "./quiet-link.module.scss";

export type QuietLinkProps = {
  readonly href: string;
  readonly children: string;
};

// A way to something rarely needed, such as the hidden customers: quiet, centred under a list, still a fair target.
// No prefetch: most visits never follow it.
export function QuietLink({ href, children }: QuietLinkProps) {
  return (
    <AppLink href={href} prefetch={false} className={styles.link}>
      {children}
    </AppLink>
  );
}
