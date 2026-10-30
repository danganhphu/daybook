"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { DeliverySubject } from "@/features/notifications/domain/delivery";
import type { InboxRowView } from "@/features/notifications/web/inbox-view";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import type { Icon } from "@/shared/ui/icon/icon";
import { iconTones, type IconTone } from "@/shared/ui/icon/icon-tone";
import { AnalyticsIcon, ChecklistIcon, KeyIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListCheck } from "@/shared/ui/list/list-check";
import { ListLink } from "@/shared/ui/list/list-link";
import { selectionCopy } from "@/shared/ui/selection-bar/selection-copy";
import type { Selection } from "@/shared/ui/selection-bar/use-selection";

import { markNotificationsRead } from "./actions";

// Each kind as the place it opens shows it: the reminders, the week's figures, the sign-in settings
const kinds = {
  morning: { icon: ChecklistIcon, tone: iconTones.note },
  weekly: { icon: AnalyticsIcon, tone: iconTones.money },
  notice: { icon: KeyIcon, tone: iconTones.item },
} as const satisfies Record<DeliverySubject, { readonly icon: Icon; readonly tone: IconTone }>;

export type InboxListProps = {
  readonly rows: ReadonlyArray<InboxRowView>;
  readonly footer: string;
  // The newest item's time, while something is unread
  readonly readUpTo: number | undefined;
  // While choosing which to delete: each row ticks instead of opening
  readonly selection: Selection | undefined;
};

// Marks the list read once it is on screen, by a request of its own: showing a page changes nothing. The screen then
// comes back with everything read, so what was unread when it opened is remembered here and stays highlighted - kept
// while choosing too, since the list stays mounted.
export function InboxList({ rows, footer, readUpTo, selection }: InboxListProps) {
  const [unreadAtOpen] = useState(
    () => new Set(rows.filter((row) => row.unread).map((row) => row.id)),
  );

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

  if (selection !== undefined) {
    return (
      <>
        <List>
          <ListCheck
            title={selectionCopy.chooseAll}
            checked={selection.allChosen}
            indeterminate={selection.chosen.size > 0 && !selection.allChosen}
            onCheckedChange={selection.toggleAll}
          />
        </List>
        <List footer={footer}>
          {rows.map((row) => (
            <ChoosableRow
              key={row.id}
              row={row}
              checked={selection.chosen.has(row.id)}
              onToggle={selection.toggle}
            />
          ))}
        </List>
      </>
    );
  }

  return (
    <List footer={footer}>
      {rows.map((row) => (
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

function ChoosableRow({
  row,
  checked,
  onToggle,
}: {
  readonly row: InboxRowView;
  readonly checked: boolean;
  readonly onToggle: (id: string, on: boolean) => void;
}) {
  const toggle = useCallback((on: boolean) => onToggle(row.id, on), [onToggle, row.id]);

  return (
    <ListCheck
      title={row.title}
      detail={`${row.when}\n${row.body}`}
      icon={kinds[row.subject].icon}
      iconTone={kinds[row.subject].tone}
      checked={checked}
      onCheckedChange={toggle}
    />
  );
}
