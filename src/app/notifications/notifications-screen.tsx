"use client";

import { startTransition, useCallback, useMemo, useOptimistic } from "react";

import type { InboxRowView, InboxView } from "@/features/notifications/web/inbox-view";
import {
  deletedNotificationsText,
  deleteNotificationsQuestion,
  notificationsCopy,
} from "@/features/notifications/web/notifications-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { Screen } from "@/shared/ui/screen/screen";
import { SelectionBar } from "@/shared/ui/selection-bar/selection-bar";
import { chosenTitle, selectionCopy } from "@/shared/ui/selection-bar/selection-copy";
import { useSelection } from "@/shared/ui/selection-bar/use-selection";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

import { deleteAllNotifications, deleteNotifications } from "./actions";
import { InboxList } from "./inbox-list";

function without(rows: ReadonlyArray<InboxRowView>, gone: ReadonlySet<string>) {
  return rows.filter((row) => !gone.has(row.id));
}

// What the app has told this person, newest first, each opening where its notification opens. Chọn deletes one, some
// or all, after asking: they go for good, as a phone's notifications do.
export function NotificationsScreen({
  view,
  back,
}: {
  readonly view: InboxView;
  readonly back: string;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [rows, hide] = useOptimistic(view.rows, without);
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const selection = useSelection(ids);
  const { choosing, chosen, stop } = selection;

  // Nothing ticked: everything goes
  const remove = useCallback(() => {
    const going = chosen.size === 0 ? ids : [...chosen];
    void (async () => {
      const sure = await confirm({
        title:
          chosen.size === 0
            ? notificationsCopy.deleteAllQuestion
            : deleteNotificationsQuestion(going.length),
        description: recentlyDeletedCopy.cannotRestore,
        confirmLabel: actionLabels.remove,
      });
      if (!sure) {
        return;
      }
      startTransition(async () => {
        hide(new Set(going));
        const result = await attempt(() =>
          chosen.size === 0 ? deleteAllNotifications() : deleteNotifications(going),
        );
        const done =
          chosen.size === 0 ? notificationsCopy.deletedAll : deletedNotificationsText(going.length);
        toast.show({ title: result.ok ? done : result.error });
        stop();
      });
    })();
  }, [chosen, confirm, hide, ids, stop, toast]);

  const headerAction = useMemo(() => {
    if (rows.length === 0) {
      return undefined;
    }
    return choosing ? (
      <Button variant="quiet" onClick={stop}>
        {actionLabels.done}
      </Button>
    ) : (
      <Button variant="quiet" onClick={selection.start}>
        {selectionCopy.choose}
      </Button>
    );
  }, [choosing, rows.length, selection.start, stop]);

  return (
    <Screen
      title={choosing ? chosenTitle(chosen.size) : notificationsCopy.title}
      back={back}
      actions={headerAction}
    >
      {rows.length === 0 ? (
        <EmptyState title={notificationsCopy.inboxEmpty} description={view.footer} />
      ) : (
        <InboxList
          rows={rows}
          footer={view.footer}
          readUpTo={view.readUpTo}
          selection={choosing ? selection : undefined}
        />
      )}
      {choosing && rows.length > 0 ? (
        <SelectionBar>
          <Button tone="danger" onClick={remove}>
            {chosen.size === 0 ? notificationsCopy.deleteAll : actionLabels.remove}
          </Button>
        </SelectionBar>
      ) : null}
      {dialog}
    </Screen>
  );
}
