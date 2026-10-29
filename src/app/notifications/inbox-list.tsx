"use client";

import { unstable_rethrow } from "next/navigation";
import { useEffect, useState } from "react";

import type { DeliverySubject } from "@/features/notifications/domain/delivery";
import type { InboxView } from "@/features/notifications/web/inbox-view";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import type { Icon } from "@/shared/ui/icon/icon";
import { iconTones, type IconTone } from "@/shared/ui/icon/icon-tone";
import { AnalyticsIcon, ChecklistIcon, KeyIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";

import { markNotificationsRead } from "./actions";

// Each kind as the place it opens shows it: the reminders, the week's figures, the sign-in settings
const kinds = {
  morning: { icon: ChecklistIcon, tone: iconTones.note },
  weekly: { icon: AnalyticsIcon, tone: iconTones.money },
  notice: { icon: KeyIcon, tone: iconTones.item },
} as const satisfies Record<DeliverySubject, { readonly icon: Icon; readonly tone: IconTone }>;

// Marks the list read once it is on screen, by a request of its own: showing a page changes nothing. The screen then
// comes back with everything read, so what was unread when it opened is remembered here and stays highlighted.
export function InboxList({ view }: { readonly view: InboxView }) {
  const [unreadAtOpen] = useState(
    () => new Set(view.rows.filter((row) => row.unread).map((row) => row.id)),
  );
  const { readUpTo } = view;

  useEffect(() => {
    if (readUpTo === undefined) {
      return;
    }
    void (async () => {
      try {
        await markNotificationsRead(readUpTo);
      } catch (error) {
        // A redirect to sign in is not a fault; anything else leaves it unread, which the bell says, until next time
        unstable_rethrow(error);
      }
    })();
  }, [readUpTo]);

  return (
    <List footer={view.footer}>
      {view.rows.map((row) => (
        <ListLink
          key={row.id}
          href={row.href}
          title={row.title}
          detail={row.body}
          value={row.when}
          icon={kinds[row.subject].icon}
          iconTone={kinds[row.subject].tone}
          unread={row.unread || unreadAtOpen.has(row.id) ? notificationsCopy.unread : undefined}
        />
      ))}
    </List>
  );
}
