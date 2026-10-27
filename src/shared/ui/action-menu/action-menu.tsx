"use client";

import { Menu } from "@base-ui/react/menu";
import { useMemo } from "react";

import { AppLink } from "@/shared/ui/app-link/app-link";
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
  // The trigger's picture; three dots unless the menu is about something else, such as the account
  readonly icon?: Icon;
  readonly actions?: ReadonlyArray<MenuAction>;
  // Always last, below a divider and in the danger color, so it is never hit by mistake
  readonly destructive?: MenuAction | undefined;
};

const noActions: ReadonlyArray<MenuAction> = [];

export function ActionMenu({
  label,
  icon = MoreHorizIcon,
  actions = noActions,
  destructive,
}: ActionMenuProps) {
  const trigger = useMemo(() => <IconButton icon={icon} label={label} />, [icon, label]);

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

// The framework's link, so the page opens without a full load. No prefetch: opening the menu rendered the page on the
// server, and following the item rendered it again.
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
  const link = useMemo(() => <AppLink href={href} prefetch={false} />, [href]);

  return (
    <Menu.LinkItem className={styles.item} data-tone={tone} render={link} closeOnClick>
      <Icon />
      {label}
    </Menu.LinkItem>
  );
}
