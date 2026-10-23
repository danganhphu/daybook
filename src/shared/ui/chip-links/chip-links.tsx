import Link from "next/link";

import styles from "./chip-links.module.scss";

export type ChipLink = {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
};

// One filter at a time, as a row of chips that scrolls sideways on a phone. Links rather than buttons: the filter lives in the URL, so back and reload keep it, and nothing waits for scripts.
export function ChipLinks({
  label,
  chips,
}: {
  readonly label: string;
  readonly chips: ReadonlyArray<ChipLink>;
}) {
  return (
    <nav aria-label={label} className={styles.chipLinks}>
      <ul className={styles.list}>
        {chips.map((chip) => (
          <li key={chip.href}>
            <Link
              href={chip.href}
              prefetch={false}
              className={styles.chip}
              aria-current={chip.current ? "page" : undefined}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
