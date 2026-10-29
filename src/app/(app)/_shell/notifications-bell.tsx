"use client";

import { usePathname } from "next/navigation";

import { badgeText, bellLabel } from "@/features/notifications/web/notifications-copy";
import { IconLink } from "@/shared/ui/button/icon-link";
import { NotificationsIcon } from "@/shared/ui/icon/icons";
import { notificationsPath } from "@/shared/web/routes";

import { tabFor } from "./sections";

// In every tab's header, before the account: the list of notifications, with how many are unread
export function NotificationsBell({ unread }: { readonly unread: number }) {
  const pathname = usePathname();

  return (
    <IconLink
      icon={NotificationsIcon}
      label={bellLabel(unread)}
      badge={badgeText(unread)}
      href={notificationsPath(tabFor(pathname))}
    />
  );
}
