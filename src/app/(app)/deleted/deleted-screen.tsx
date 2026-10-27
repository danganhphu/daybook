"use client";

import { startTransition, useCallback, useOptimistic } from "react";

import { restoreOrder } from "@/app/(app)/orders/actions";
import { restoreReminder } from "@/app/(app)/reminders/actions";
import { restoreNote } from "@/app/actions";
import type { Result } from "@/shared/domain/result";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import type { Icon } from "@/shared/ui/icon/icon";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import { EditNoteIcon, NotificationsIcon, ReceiptLongIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { recentlyDeletedCopy, type DeletedRowView } from "@/shared/web/recently-deleted";
import { routes } from "@/shared/web/routes";

export type DeletedScreenProps = {
  readonly orders: ReadonlyArray<DeletedRowView>;
  readonly notes: ReadonlyArray<DeletedRowView>;
  readonly reminders: ReadonlyArray<DeletedRowView>;
};

// What was deleted lately, once the Undo toast is gone: orders, notes and reminders, latest first, each one tap from
// back where it was
export function DeletedScreen({ orders, notes, reminders }: DeletedScreenProps) {
  const nothing = orders.length + notes.length + reminders.length === 0;

  return (
    <Screen
      title={recentlyDeletedCopy.title}
      subtitle={recentlyDeletedCopy.window}
      back={routes.settings}
    >
      {nothing ? (
        <EmptyState title={recentlyDeletedCopy.empty} />
      ) : (
        <>
          <DeletedList
            heading={recentlyDeletedCopy.orders}
            rows={orders}
            icon={ReceiptLongIcon}
            restore={restoreOrder}
          />
          <DeletedList
            heading={recentlyDeletedCopy.notes}
            rows={notes}
            icon={EditNoteIcon}
            restore={restoreNote}
          />
          <DeletedList
            heading={recentlyDeletedCopy.reminders}
            rows={reminders}
            icon={NotificationsIcon}
            restore={restoreReminder}
          />
        </>
      )}
    </Screen>
  );
}

function without(rows: ReadonlyArray<DeletedRowView>, id: string) {
  return rows.filter((row) => row.id !== id);
}

function DeletedList({
  heading,
  rows,
  icon,
  restore,
}: {
  readonly heading: string;
  readonly rows: ReadonlyArray<DeletedRowView>;
  readonly icon: Icon;
  readonly restore: (id: string, version: number) => Promise<Result<unknown, string>>;
}) {
  const toast = useToast();
  const [shown, hide] = useOptimistic(rows, without);

  const bringBack = useCallback(
    (row: DeletedRowView) => {
      startTransition(async () => {
        hide(row.id);
        const result = await attempt(() => restore(row.id, row.version));
        toast.show(
          result.ok
            ? { title: recentlyDeletedCopy.restored, description: row.title }
            : { title: result.error },
        );
      });
    },
    [hide, restore, toast],
  );

  if (shown.length === 0) {
    return null;
  }

  return (
    <List heading={heading}>
      {shown.map((row) => (
        <DeletedRow key={row.id} row={row} icon={icon} onRestore={bringBack} />
      ))}
    </List>
  );
}

function DeletedRow({
  row,
  icon,
  onRestore,
}: {
  readonly row: DeletedRowView;
  readonly icon: Icon;
  readonly onRestore: (row: DeletedRowView) => void;
}) {
  const restore = useCallback(() => onRestore(row), [onRestore, row]);

  return (
    <ListRow title={row.title} detail={row.detail} icon={icon} iconTone={iconTones.danger}>
      <Button variant="quiet" onClick={restore}>
        {actionLabels.restore}
      </Button>
    </ListRow>
  );
}
