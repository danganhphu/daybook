import type { ReactNode } from "react";

import { actionLabels } from "@/shared/ui/action-labels";
import { IconLink } from "@/shared/ui/button/icon-link";
import { ArrowBackIcon } from "@/shared/ui/icon/icons";

import styles from "./page-header.module.scss";

export type PageHeaderProps = {
  readonly title: string;
  // Small, under the title: a date, an area
  readonly subtitle?: string | undefined;
  // Where the back arrow goes; none on a tab's own screen
  readonly back?: string | undefined;
  // At the end of the line: an icon link, a menu
  readonly actions?: ReactNode;
};

// The top of a screen: back on the left where the thumb finds it, the title, then what can be done here. A tab's own
// screen has no way back and a large title, as ColorOS sets "Tiện ích"; a page within it a smaller one.
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <header className={styles.header} data-root={back === undefined ? "" : undefined}>
      {back === undefined ? null : (
        <IconLink icon={ArrowBackIcon} label={actionLabels.back} href={back} prefetch={false} />
      )}
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
