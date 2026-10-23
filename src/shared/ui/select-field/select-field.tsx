import { useId, type ComponentProps } from "react";

import { KeyboardArrowDownIcon } from "@/shared/ui/icon/icons";

import styles from "./select-field.module.scss";

export type SelectOption = { readonly value: string; readonly label: string };

export type SelectFieldProps = Omit<
  ComponentProps<"select">,
  "className" | "style" | "children" | "multiple" | "id"
> & {
  readonly label: string;
  readonly options: ReadonlyArray<SelectOption>;
  // The first choice, meaning none of them: "Không chọn", "Tất cả"
  readonly emptyLabel?: string | undefined;
  readonly error?: string | undefined;
};

// One choice from a short list, labelled like a text field. The browser's own select: on a phone it opens the
// system's picker, which is what a thumb expects and what a screen reader knows.
export function SelectField({ label, options, emptyLabel, error, ...props }: SelectFieldProps) {
  const id = useId();
  const errorId = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.box} data-invalid={error === undefined ? undefined : ""}>
        <select
          {...props}
          id={id}
          className={styles.select}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        >
          {emptyLabel === undefined ? null : <option value="">{emptyLabel}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <KeyboardArrowDownIcon aria-hidden className={styles.chevron} />
      </div>
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
