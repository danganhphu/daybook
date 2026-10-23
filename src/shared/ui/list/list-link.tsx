import Link from "next/link";

import type { Icon } from "@/shared/ui/icon/icon";
import type { IconTone } from "@/shared/ui/icon/icon-tone";
import { ChevronRightIcon } from "@/shared/ui/icon/icons";

import { RowIcon } from "./row-icon";

import styles from "./list.module.scss";

export type ListLinkProps = {
  readonly href: string;
  readonly title: string;
  readonly detail?: string | undefined;
  // A value at the row's end, such as what is owed; danger draws attention to it
  readonly value?: string | undefined;
  readonly valueTone?: "neutral" | "danger";
  // Leading the row, in the colour of what it is about
  readonly icon?: Icon | undefined;
  readonly iconTone?: IconTone;
};

// A row that opens a page of its own: the whole row is the link, with a chevron to say so. No prefetch: a list of
// them would render every page it points at.
export function ListLink({
  href,
  title,
  detail,
  value,
  valueTone = "neutral",
  icon,
  iconTone = "neutral",
}: ListLinkProps) {
  return (
    <li>
      <Link href={href} prefetch={false} className={styles.link}>
        {icon === undefined ? null : <RowIcon icon={icon} tone={iconTone} />}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {detail === undefined ? null : <span className={styles.detail}>{detail}</span>}
        </span>
        {value === undefined ? null : (
          <span className={styles.value} data-tone={valueTone}>
            {value}
          </span>
        )}
        <ChevronRightIcon aria-hidden className={styles.chevron} />
      </Link>
    </li>
  );
}
