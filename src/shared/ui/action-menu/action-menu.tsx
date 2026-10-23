"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useMemo } from "react";

import { IconButton } from "@/shared/ui/button/icon-button";
import type { Icon } from "@/shared/ui/icon/icon";
import { MoreHorizIcon } from "@/shared/ui/icon/icons";

import styles from "./action-menu.module.scss";

// An item does something here, or goes to another page; a page is a real link, so it can open in a new tab
export type MenuAction = { readonly label: string; readonly icon: Icon } & (
  | { readonly onSelect: () => void }
  | { readonly href: string }
);

export type ActionMenuProps = {
  // Names the trigger for screen readers, e.g. "Tuỳ chọn cho ghi chú"
  readonly label: string;
  readonly actions?: ReadonlyArray<MenuAction>;
  // Always last, below a divider and in the danger color, so it is never hit by mistake
  readonly destructive?: MenuAction | undefined;
};

const noActions: ReadonlyArray<MenuAction> = [];

export function ActionMenu({ label, actions = noActions, destructive }: ActionMenuProps) {
  const trigger = useMemo(() => <IconButton icon={MoreHorizIcon} label={label} />, [label]);

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
  const tone = danger ? "danger" : "neutral";

  if ("href" in action) {
    return <MenuLink label={action.label} icon={Icon} href={action.href} tone={tone} />;
  }

  return (
    <Menu.Item className={styles.item} data-tone={tone} onClick={action.onSelect}>
      <Icon />
      {action.label}
    </Menu.Item>
  );
}

// The framework's link, so the page opens without a full load
function MenuLink({
  label,
  icon: Icon,
  href,
  tone,
}: {
  readonly label: string;
  readonly icon: Icon;
  readonly href: string;
  readonly tone: "danger" | "neutral";
}) {
  const link = useMemo(() => <Link href={href} />, [href]);

  return (
    <Menu.LinkItem className={styles.item} data-tone={tone} render={link} closeOnClick>
      <Icon />
      {label}
    </Menu.LinkItem>
  );
}
