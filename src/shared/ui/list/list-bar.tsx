import { AppLink } from "@/shared/ui/app-link/app-link";
import { ChevronRightIcon } from "@/shared/ui/icon/icons";

import styles from "./list.module.scss";

export type ListBarProps = {
  readonly title: string;
  readonly detail?: string | undefined;
  // The figure the row is ranked by, written out
  readonly value: string;
  // The figure against the largest row's, in whole percent
  readonly share: number;
  // A row that narrows the screen to itself, such as a report to one product
  readonly href?: string | undefined;
};

// A row of a ranking: what it is, how much, and a bar under it for how much against the largest. The value is
// written, so the bar adds nothing a screen reader needs.
export function ListBar({ title, detail, value, share, href }: ListBarProps) {
  const content = (
    <>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {detail === undefined ? null : <span className={styles.detail}>{detail}</span>}
        <span className={styles.bar} data-share={share} aria-hidden />
      </span>
      <span className={styles.value}>{value}</span>
    </>
  );

  return (
    <li>
      {href === undefined ? (
        <div className={styles.row}>{content}</div>
      ) : (
        <AppLink href={href} prefetch={false} className={styles.link}>
          {content}
          <ChevronRightIcon aria-hidden className={styles.chevron} />
        </AppLink>
      )}
    </li>
  );
}
