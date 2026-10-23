"use client";

import { useCallback, useOptimistic, useState } from "react";

import type { ReminderView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { AddIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";

import { ReminderDialog } from "./reminder-dialog";
import { ReminderRow } from "./reminder-row";
import { useReminderChanges } from "./use-reminder-changes";

export type ReminderListProps = {
  readonly heading: string;
  readonly reminders: ReadonlyArray<ReminderView>;
  readonly today: string;
  readonly showDue: boolean;
  // Off on the customer's own page
  readonly showCustomer?: boolean;
  // An add row under the list; new ones, and edits, keep this customer when given
  readonly adding?:
    | { readonly customer?: { readonly id: string; readonly name: string } | undefined }
    | undefined;
  // Said in a row when the list is empty
  readonly empty?: string | undefined;
};

function without(list: ReadonlyArray<ReminderView>, id: string): ReadonlyArray<ReminderView> {
  return list.filter((reminder) => reminder.id !== id);
}

export function ReminderList({
  heading,
  reminders,
  today,
  showDue,
  showCustomer = true,
  adding,
  empty,
}: ReminderListProps) {
  const [shown, hide] = useOptimistic(reminders, without);
  const { complete, remove } = useReminderChanges(hide);
  const [editing, setEditing] = useState<ReminderView | "new">();
  const close = useCallback(() => setEditing(undefined), []);
  const add = useCallback(() => setEditing("new"), []);

  return (
    <>
      <List heading={heading}>
        {shown.length === 0 && empty !== undefined ? <ListRow title={empty} /> : null}
        {shown.map((reminder) => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            showDue={showDue}
            showCustomer={showCustomer}
            onDone={complete}
            onEdit={setEditing}
            onDelete={remove}
          />
        ))}
        {adding === undefined ? null : (
          <ListAction label={remindersCopy.add} icon={AddIcon} onClick={add} />
        )}
      </List>
      {editing === undefined ? null : (
        <ReminderDialog
          onClose={close}
          today={today}
          reminder={editing === "new" ? undefined : editing}
          customer={adding?.customer}
        />
      )}
    </>
  );
}
