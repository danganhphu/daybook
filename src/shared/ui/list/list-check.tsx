"use client";

import { Checkbox } from "@base-ui/react/checkbox";

import type { Icon } from "@/shared/ui/icon/icon";
import type { IconTone } from "@/shared/ui/icon/icon-tone";
import { CheckIcon, RemoveIcon } from "@/shared/ui/icon/icons";

import { RowIcon } from "./row-icon";

import styles from "./list.module.scss";

export type ListCheckProps = {
  readonly title: string;
  readonly detail?: string | undefined;
  readonly icon?: Icon | undefined;
  readonly iconTone?: IconTone;
  readonly checked: boolean;
  // Some chosen and not all: for the row that chooses them all
  readonly indeterminate?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
};

// A row being chosen for an action on many: the whole row is the checkbox's label, so a tap anywhere on it ticks it.
// Shown only while choosing, which starts on a tap, so it is drawn in the browser: Base UI's hidden input carries a
// style attribute the CSP would refuse in the server's HTML.
export function ListCheck({
  title,
  detail,
  icon,
  iconTone = "neutral",
  checked,
  indeterminate = false,
  onCheckedChange,
}: ListCheckProps) {
  return (
    <li>
      <label className={styles.check}>
        <Checkbox.Root
          className={styles.checkbox}
          checked={checked}
          indeterminate={indeterminate}
          onCheckedChange={onCheckedChange}
        >
          <Checkbox.Indicator className={styles.checkMark}>
            {indeterminate ? <RemoveIcon aria-hidden /> : <CheckIcon aria-hidden />}
          </Checkbox.Indicator>
        </Checkbox.Root>
        {icon === undefined ? null : <RowIcon icon={icon} tone={iconTone} />}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {detail === undefined ? null : <span className={styles.detail}>{detail}</span>}
        </span>
      </label>
    </li>
  );
}
