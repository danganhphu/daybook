import type { ComponentProps } from "react";

import { SearchIcon } from "@/shared/ui/icon/icons";

import styles from "./search-field.module.scss";

export type SearchFieldProps = Omit<
  ComponentProps<"input">,
  "className" | "style" | "type" | "children" | "aria-label"
> & {
  // The accessible name; the magnifier and the placeholder are all a sighted user needs
  readonly label: string;
};

// A search box as a phone app has it: a pill with a magnifier, a clear button from the browser, and a keyboard whose
// Enter key says search
export function SearchField({ label, ...props }: SearchFieldProps) {
  return (
    <span className={styles.searchField}>
      <SearchIcon aria-hidden className={styles.icon} />
      {/* An input is twenty characters wide of its own, which can hold the box wider than a narrow screen */}
      <input
        size={1}
        {...props}
        type="search"
        enterKeyHint="search"
        aria-label={label}
        className={styles.input}
      />
    </span>
  );
}
