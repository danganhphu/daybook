import type { ReactNode } from "react";

import type { Icon } from "@/shared/ui/icon/icon";
import type { IconTone } from "@/shared/ui/icon/icon-tone";

import { RowIcon } from "./row-icon";

import styles from "./list.module.scss";

export type ListRowProps = {
  readonly title: string;
  // The one value that tells two rows apart: a time, a device, a state
  readonly detail?: string | undefined;
  // Leading the row, in the colour of what it is about
  readonly icon?: Icon | undefined;
  readonly iconTone?: IconTone;
  // What can be done to this row, at its end: a quiet button or an ActionMenu
  readonly children?: ReactNode;
};

export function ListRow({ title, detail, icon, iconTone = "neutral", children }: ListRowProps) {
  return (
    <li className={styles.row}>
      {icon === undefined ? null : <RowIcon icon={icon} tone={iconTone} />}
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {detail === undefined ? null : <p className={styles.detail}>{detail}</p>}
      </div>
      {children}
    </li>
  );
}
