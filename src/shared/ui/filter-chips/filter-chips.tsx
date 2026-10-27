import { AppLink } from "@/shared/ui/app-link/app-link";
import { CloseIcon } from "@/shared/ui/icon/icons";

import styles from "./filter-chips.module.scss";

export type FilterChip = {
  readonly label: string;
  // The same screen without this filter
  readonly removeHref: string;
};

export type FilterChipsProps = {
  // What the row is, such as "Đang lọc"
  readonly label: string;
  readonly chips: ReadonlyArray<FilterChip>;
  // The link's name, with the chip's own words in it: "Bỏ lọc Kim nha khoa"
  readonly removeLabel: (label: string) => string;
};

// The filters in force beside what they filter, each a chip that drops it. Links, so the filter lives in the URL.
export function FilterChips({ label, chips, removeLabel }: FilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label}>
      <ul className={styles.list}>
        {chips.map((chip) => (
          <li key={chip.removeHref}>
            <AppLink
              href={chip.removeHref}
              prefetch={false}
              className={styles.chip}
              aria-label={removeLabel(chip.label)}
            >
              {chip.label}
              <CloseIcon aria-hidden />
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
