"use client";

import { startTransition, useCallback, useMemo, useOptimistic } from "react";

import type { TrashKind } from "@/features/trash/domain/trash";
import type { TrashOutcomeView, TrashRowView } from "@/features/trash/web/commands";
import {
  notPurgedText,
  notRestoredText,
  purgedText,
  purgeQuestion,
  restoredText,
  trashCopy,
} from "@/features/trash/web/trash-copy";
import type { Result } from "@/shared/domain/result";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import type { Icon } from "@/shared/ui/icon/icon";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  DeleteForeverIcon,
  EditNoteIcon,
  Inventory2Icon,
  LabelIcon,
  NotificationsIcon,
  PersonIcon,
  ReceiptLongIcon,
  RestoreFromTrashIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListCheck } from "@/shared/ui/list/list-check";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";
import { SelectionBar } from "@/shared/ui/selection-bar/selection-bar";
import { chosenTitle, selectionCopy } from "@/shared/ui/selection-bar/selection-copy";
import { useSelection } from "@/shared/ui/selection-bar/use-selection";
import type { ToastOptions } from "@/shared/ui/toast/use-toast";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";
import { routes } from "@/shared/web/routes";

import { purgeFromTrash, restoreFromTrash } from "./actions";

const kindIcons: Record<TrashKind, Icon> = {
  order: ReceiptLongIcon,
  note: EditNoteIcon,
  reminder: NotificationsIcon,
  customer: PersonIcon,
  product: Inventory2Icon,
  kind: LabelIcon,
};

type Rows = ReadonlyArray<TrashRowView>;

function itemsOf(rows: Rows) {
  return rows.map(({ kind, id, version }) => ({ kind, id, shown: version }));
}

function without(rows: Rows, gone: ReadonlySet<string>): Rows {
  return rows.filter((row) => !gone.has(row.id));
}

// What the toast says once it is done: how many, or which could not and why
function outcomeToast(
  result: Result<TrashOutcomeView, string>,
  chosen: Rows,
  doneText: (count: number) => string,
  notDoneText: (count: number) => string,
): ToastOptions {
  if (!result.ok) {
    return { title: result.error };
  }
  const [first] = result.value.refused;
  if (first === undefined) {
    const [only] = chosen;
    return chosen.length === 1 && only !== undefined
      ? { title: doneText(1), description: only.title }
      : { title: doneText(result.value.done) };
  }
  const name = chosen.find((row) => row.id === first.id)?.title;

  return {
    title: notDoneText(result.value.refused.length),
    description: name === undefined ? first.message : `${name}: ${first.message}`,
  };
}

// Everything deleted lately, newest first, until it is restored or gone for good: one at a time from its menu, or many
// at once after Chọn, as the trash of the phone's own photo apps works. Restoring is never asked about, deleting for
// good always is.
export function DeletedScreen({ rows }: { readonly rows: Rows }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [shown, hide] = useOptimistic(rows, without);
  const ids = useMemo(() => shown.map((row) => row.id), [shown]);
  const selection = useSelection(ids);
  const { choosing, chosen, stop } = selection;
  const picked = useMemo(() => shown.filter((row) => chosen.has(row.id)), [chosen, shown]);
  // Nothing ticked: the bar acts on everything shown
  const targets = picked.length === 0 ? shown : picked;

  const restore = useCallback(
    (going: Rows) => {
      startTransition(async () => {
        hide(new Set(going.map((row) => row.id)));
        const result = await attempt(() => restoreFromTrash(itemsOf(going)));
        toast.show(outcomeToast(result, going, restoredText, notRestoredText));
        stop();
      });
    },
    [hide, stop, toast],
  );

  const purge = useCallback(
    (going: Rows) => {
      void (async () => {
        const sure = await confirm({
          title: purgeQuestion(going.length),
          description: going.some((row) => row.kind === "customer")
            ? `${trashCopy.purgeTakesOrders} ${recentlyDeletedCopy.cannotRestore}`
            : recentlyDeletedCopy.cannotRestore,
          confirmLabel: trashCopy.purge,
        });
        if (!sure) {
          return;
        }
        startTransition(async () => {
          hide(new Set(going.map((row) => row.id)));
          const result = await attempt(() => purgeFromTrash(itemsOf(going)));
          toast.show(outcomeToast(result, going, purgedText, notPurgedText));
          stop();
        });
      })();
    },
    [confirm, hide, stop, toast],
  );

  const restoreTargets = useCallback(() => restore(targets), [restore, targets]);
  const purgeTargets = useCallback(() => purge(targets), [purge, targets]);
  const headerAction = useMemo(() => {
    if (shown.length === 0) {
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
  }, [choosing, selection.start, shown.length, stop]);

  return (
    <Screen
      title={choosing ? chosenTitle(chosen.size) : recentlyDeletedCopy.title}
      subtitle={choosing ? undefined : recentlyDeletedCopy.window}
      back={routes.settings}
      actions={headerAction}
    >
      {shown.length === 0 ? (
        <EmptyState title={recentlyDeletedCopy.empty} />
      ) : choosing ? (
        <>
          <List>
            <ListCheck
              title={selectionCopy.chooseAll}
              checked={selection.allChosen}
              indeterminate={chosen.size > 0 && !selection.allChosen}
              onCheckedChange={selection.toggleAll}
            />
          </List>
          <List>
            {shown.map((row) => (
              <ChoosableRow
                key={row.id}
                row={row}
                checked={chosen.has(row.id)}
                onToggle={selection.toggle}
              />
            ))}
          </List>
          <SelectionBar>
            <Button onClick={restoreTargets}>
              {picked.length === 0 ? trashCopy.restoreAll : actionLabels.restore}
            </Button>
            <Button tone="danger" onClick={purgeTargets}>
              {picked.length === 0 ? trashCopy.purgeAll : trashCopy.purge}
            </Button>
          </SelectionBar>
        </>
      ) : (
        <List>
          {shown.map((row) => (
            <TrashRow key={row.id} row={row} onRestore={restore} onPurge={purge} />
          ))}
        </List>
      )}
      {dialog}
    </Screen>
  );
}

function TrashRow({
  row,
  onRestore,
  onPurge,
}: {
  readonly row: TrashRowView;
  readonly onRestore: (rows: Rows) => void;
  readonly onPurge: (rows: Rows) => void;
}) {
  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: actionLabels.restore, icon: RestoreFromTrashIcon, onSelect: () => onRestore([row]) },
    ],
    [onRestore, row],
  );
  const destructive = useMemo<MenuAction>(
    () => ({ label: trashCopy.purge, icon: DeleteForeverIcon, onSelect: () => onPurge([row]) }),
    [onPurge, row],
  );

  return (
    <ListRow
      title={row.title}
      detail={row.detail}
      icon={kindIcons[row.kind]}
      iconTone={iconTones.danger}
    >
      <ActionMenu label={optionsFor(row.title)} actions={actions} destructive={destructive} />
    </ListRow>
  );
}

function ChoosableRow({
  row,
  checked,
  onToggle,
}: {
  readonly row: TrashRowView;
  readonly checked: boolean;
  readonly onToggle: (id: string, on: boolean) => void;
}) {
  const toggle = useCallback((on: boolean) => onToggle(row.id, on), [onToggle, row.id]);

  return (
    <ListCheck
      title={row.title}
      detail={row.detail}
      icon={kindIcons[row.kind]}
      iconTone={iconTones.danger}
      checked={checked}
      onCheckedChange={toggle}
    />
  );
}
