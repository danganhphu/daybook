"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef } from "react";

import { accessCopy } from "@/features/access/web/access-copy";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { LogoutIcon, PersonIcon, SettingsIcon } from "@/shared/ui/icon/icons";
import { routes, settingsPath } from "@/shared/web/routes";

import { tabFor } from "./sections";

// At the end of every tab's own header
export function AccountMenu() {
  const pathname = usePathname();
  const signOutForm = useRef<HTMLFormElement>(null);
  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: accessCopy.settings, icon: SettingsIcon, href: settingsPath(tabFor(pathname)) },
      {
        label: accessCopy.signOut,
        icon: LogoutIcon,
        onSelect: () => signOutForm.current?.requestSubmit(),
      },
    ],
    [pathname],
  );

  return (
    <>
      <ActionMenu label={accessCopy.account} icon={PersonIcon} actions={actions} />
      {/* A plain POST, so the response can tell the browser to drop the cookies */}
      <form ref={signOutForm} method="post" action={routes.signOut} hidden />
    </>
  );
}
