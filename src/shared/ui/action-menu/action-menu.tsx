"use client";

import { Menu } from "@base-ui/react/menu";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { IconButton } from "@/shared/ui/button/icon-button";

import styles from "./action-menu.module.scss";

export type MenuAction = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
};

export type ActionMenuProps = {
  // Names the trigger for screen readers, e.g. "Tuỳ chọn cho ghi chú"
  readonly label: string;
  readonly actions: ReadonlyArray<MenuAction>;
  // Always last, below a divider and in the danger color, so it is never hit by mistake
  readonly destructive?: MenuAction;
};

export function ActionMenu({ label, actions, destructive }: ActionMenuProps) {
  const trigger = useMemo(() => <IconButton icon={Ellipsis} label={label} />, [label]);

  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} align="end" sideOffset={4}>
          <Menu.Popup className={styles.popup}>
            {actions.map((action) => (
              <MenuItem key={action.label} action={action} />
            ))}
            {destructive === undefined ? null : (
              <>
                {actions.length > 0 ? <Menu.Separator className={styles.separator} /> : null}
                <MenuItem action={destructive} danger />
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MenuItem({
  action,
  danger = false,
}: {
  readonly action: MenuAction;
  readonly danger?: boolean;
}) {
  const Icon = action.icon;

  return (
    <Menu.Item
      className={styles.item}
      data-tone={danger ? "danger" : "neutral"}
      onClick={action.onSelect}
    >
      <Icon />
      {action.label}
    </Menu.Item>
  );
}
