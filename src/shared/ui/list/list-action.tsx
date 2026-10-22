import { Button as BaseButton } from "@base-ui/react/button";
import type { LucideIcon } from "lucide-react";

import styles from "./list.module.scss";

export type ListActionProps = Omit<BaseButton.Props, "className" | "style" | "children"> & {
  readonly label: string;
  readonly icon: LucideIcon;
  // Danger for an action that ends something, such as signing out
  readonly tone?: "accent" | "danger";
};

// A row that is itself the action, such as "Thêm ..." under the list it adds to
export function ListAction({ label, icon: Icon, tone = "accent", ...props }: ListActionProps) {
  return (
    <li>
      <BaseButton {...props} className={styles.action} data-tone={tone}>
        <Icon />
        {label}
      </BaseButton>
    </li>
  );
}
