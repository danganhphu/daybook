"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  // At the end of the bar: an icon link, a menu
  readonly actions?: ReactNode;
};

// A bar that stays at the top while the page scrolls under it. A tab's own screen has a large title below the bar,
// which moves into the bar once it has scrolled under it; a page within a tab has its title in the bar from the start.
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const isRoot = back === undefined;
  const below = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const target = below.current;
    if (target === null) {
      return undefined;
    }
    const bar = target.previousElementSibling?.getBoundingClientRect().height ?? 0;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setScrolled(
          entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < bar,
        ),
      { rootMargin: `-${Math.ceil(bar)}px 0px 0px 0px` },
    );
    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className={styles.bar} data-scrolled={scrolled ? "" : undefined}>
        <div className={styles.barInner}>
          {isRoot ? null : (
            <IconLink icon={ArrowBackIcon} label={actionLabels.back} href={back} prefetch={false} />
          )}
          <div className={styles.barHeading}>
            {isRoot ? (
              <p className={styles.barTitle} aria-hidden>
                {title}
              </p>
            ) : (
              <>
                <h1 className={styles.barTitle}>{title}</h1>
                {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
              </>
            )}
          </div>
          {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      <div ref={below} className={isRoot ? styles.large : styles.edge}>
        {isRoot ? (
          <>
            <h1 className={styles.title}>{title}</h1>
            {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
          </>
        ) : null}
      </div>
    </>
  );
}
