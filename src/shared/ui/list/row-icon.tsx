import type { Icon } from "@/shared/ui/icon/icon";
import type { IconTone } from "@/shared/ui/icon/icon-tone";

import styles from "./list.module.scss";

// The coloured icon that leads a row; decoration, so a screen reader skips it
export function RowIcon({ icon: Icon, tone }: { readonly icon: Icon; readonly tone: IconTone }) {
  return (
    <span className={styles.rowIcon} data-tone={tone}>
      <Icon filled />
    </span>
  );
}
