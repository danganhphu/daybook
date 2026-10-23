"use client";

import { useCallback, useMemo } from "react";

import { preview } from "@/features/notes/web/note-view";
import type { ReminderView } from "@/features/reminders/web/reminder-view";
import { markDone } from "@/features/reminders/web/reminders-copy";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { IconButton } from "@/shared/ui/button/icon-button";
import { DeleteIcon, EditIcon, RadioButtonUncheckedIcon } from "@/shared/ui/icon/icons";

import styles from "./reminder-row.module.scss";

export type ReminderRowProps = {
  readonly reminder: ReminderView;
  // Off under a heading that already says the day; an overdue one always says how late
  readonly showDue: boolean;
  // Off on the customer's own page
  readonly showCustomer: boolean;
  readonly onDone: (reminder: ReminderView) => void;
  readonly onEdit: (reminder: ReminderView) => void;
  readonly onDelete: (reminder: ReminderView) => void;
};

export function ReminderRow({
  reminder,
  showDue,
  showCustomer,
  onDone,
  onEdit,
  onDelete,
}: ReminderRowProps) {
  const done = useCallback(() => onDone(reminder), [onDone, reminder]);
  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [{ label: actionLabels.edit, icon: EditIcon, onSelect: () => onEdit(reminder) }],
    [onEdit, reminder],
  );
  const destructive = useMemo<MenuAction>(
    () => ({ label: actionLabels.remove, icon: DeleteIcon, onSelect: () => onDelete(reminder) }),
    [onDelete, reminder],
  );
  const shortText = preview(reminder.text);
  const due = showDue || reminder.overdue ? reminder.due : undefined;
  const customer = showCustomer ? reminder.customer?.name : undefined;

  return (
    <li className={styles.row}>
      <IconButton icon={RadioButtonUncheckedIcon} label={markDone(shortText)} onClick={done} />
      <div className={styles.text}>
        <p className={styles.title}>{reminder.text}</p>
        {customer === undefined && due === undefined ? null : (
          <p className={styles.detail}>
            {customer}
            {customer !== undefined && due !== undefined ? ", " : null}
            {due === undefined ? null : (
              <span data-overdue={reminder.overdue ? "" : undefined}>{due}</span>
            )}
          </p>
        )}
      </div>
      <ActionMenu
        label={optionsFor(`việc "${shortText}"`)}
        actions={actions}
        destructive={destructive}
      />
    </li>
  );
}
