"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo, useState } from "react";

import { MergeDialog } from "@/app/(app)/_merge/merge-dialog";
import { OtherNames } from "@/app/(app)/_names/other-names";
import { ReminderList } from "@/app/(app)/_reminders/reminder-list";
import {
  addCustomerName,
  customerDeleteConfirm,
  customerMergeConfirm,
  deleteCustomer,
  hideCustomer,
  mergeCustomer,
  removeCustomerName,
  showCustomer,
} from "@/app/(app)/customers/actions";
import { undoDelete } from "@/app/(app)/deleted/undo-delete";
import { findCustomers } from "@/app/(app)/orders/actions";
import { customerLimits } from "@/features/customers/domain/customer-limits";
import type { CustomerScreenView } from "@/features/customers/web/commands";
import { customerDetail } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { mergingCopy, pickCustomerHint } from "@/features/merging/web/merging-copy";
import { shortDay } from "@/features/orders/web/day-text";
import { describeCustomer, type OrderRowView } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { newOrderPath } from "@/features/orders/web/orders-path";
import type { CustomerRemindersView } from "@/features/reminders/web/commands";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  AddIcon,
  CallIcon,
  DeleteIcon,
  EditIcon,
  LocationOnIcon,
  MergeIcon,
  ReceiptLongIcon,
  StickyNote2Icon,
  VisibilityIcon,
  VisibilityOffIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { ListRow } from "@/shared/ui/list/list-row";
import { Notice } from "@/shared/ui/notice/notice";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { moneyText } from "@/shared/web/money-text";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";
import { customerPath, editCustomerPath, orderPath, routes } from "@/shared/web/routes";

import styles from "./customer-screen.module.scss";

export type CustomerScreenProps = {
  readonly view: CustomerScreenView;
  // Newest first
  readonly orders: ReadonlyArray<OrderRowView & { readonly orderedOn: string }>;
  readonly reminders: CustomerRemindersView;
};

const suggestCustomers = (text: string) => findCustomers(text);

function orderDetail(order: OrderRowView): string {
  return [order.products, order.delivered ? undefined : ordersCopy.undelivered]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
}

// One customer: what they bought and owe at the top, a new order one tap away, how to reach them, then their orders
export function CustomerScreen({ view, orders, reminders }: CustomerScreenProps) {
  const toast = useToast();
  const adding = useMemo(
    () => (view.hidden ? undefined : { customer: { id: view.id, name: view.name } }),
    [view.hidden, view.id, view.name],
  );

  const toggleHidden = useCallback(() => {
    startTransition(async () => {
      const change = view.hidden ? showCustomer : hideCustomer;
      const result = await attempt(() => change(view.id, view.version));
      if (!result.ok) {
        toast.show({ title: result.error });
        return;
      }
      toast.show({ title: view.hidden ? customersCopy.shownToast : customersCopy.hiddenToast });
    });
  }, [toast, view.hidden, view.id, view.version]);

  const [merging, setMerging] = useState(false);
  const openMerge = useCallback(() => setMerging(true), []);
  const closeMerge = useCallback(() => setMerging(false), []);
  const confirmMerge = useCallback(
    (intoId: string) => customerMergeConfirm(view.id, intoId),
    [view.id],
  );
  const merge = useCallback(
    (intoId: string) => mergeCustomer(view.id, view.version, intoId),
    [view.id, view.version],
  );
  const addName = useCallback((name: string) => addCustomerName(view.id, name), [view.id]);

  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  // Asked first, saying what goes with them; then the list, with Undo in the toast
  const remove = useCallback(() => {
    void (async () => {
      const asked = await attempt(() => customerDeleteConfirm(view.id));
      if (!asked.ok) {
        toast.show({ title: asked.error });
        return;
      }
      if (!(await confirm(asked.value))) {
        return;
      }
      startTransition(async () => {
        const result = await attempt(() => deleteCustomer(view.id, view.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }
        const version = result.value;
        toast.show({
          title: customersCopy.deleted,
          action: {
            label: actionLabels.undo,
            onAction: () => {
              startTransition(async () => {
                toast.show(await undoDelete({ kind: "customer", id: view.id, version }));
              });
            },
          },
        });
        router.push(routes.customers);
      });
    })();
  }, [confirm, router, toast, view.id, view.version]);

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: customersCopy.edit, icon: EditIcon, href: editCustomerPath(view.id) },
      view.hidden
        ? { label: customersCopy.show, icon: VisibilityIcon, onSelect: toggleHidden }
        : { label: customersCopy.hide, icon: VisibilityOffIcon, onSelect: toggleHidden },
      { label: mergingCopy.mergeCustomer, icon: MergeIcon, onSelect: openMerge },
    ],
    [openMerge, toggleHidden, view.hidden, view.id],
  );
  const destructive = useMemo<MenuAction>(
    () => ({ label: customersCopy.remove, icon: DeleteIcon, onSelect: remove }),
    [remove],
  );
  // A merged customer has nothing left to change: its orders are with the one kept. A deleted one comes back from
  // the trash.
  const menu = useMemo(
    () =>
      view.mergedInto === undefined && !view.deleted ? (
        <ActionMenu label={actionLabels.options} actions={actions} destructive={destructive} />
      ) : undefined,
    [actions, destructive, view.deleted, view.mergedInto],
  );
  const stats = useMemo<ReadonlyArray<Stat>>(
    () => [
      { label: customersCopy.bought, value: moneyText(view.total) },
      {
        label: customersCopy.owes,
        value: moneyText(view.owed),
        tone: view.owed > 0 ? "danger" : "neutral",
      },
      {
        label: customersCopy.lastOrder,
        value: view.lastOrderedOn === undefined ? "-" : shortDay(view.lastOrderedOn),
      },
    ],
    [view.lastOrderedOn, view.owed, view.total],
  );

  return (
    <Screen
      title={view.name}
      subtitle={customerDetail(view)}
      back={routes.customers}
      actions={menu}
    >
      {view.mergedInto === undefined ? null : (
        <Notice message={mergingCopy.customerIsMerged}>
          <ButtonLink href={customerPath(view.mergedInto)}>{mergingCopy.seeKept}</ButtonLink>
        </Notice>
      )}
      {view.deleted ? (
        <Notice message={customersCopy.isDeleted} tone="danger">
          <ButtonLink href={routes.deleted}>{recentlyDeletedCopy.title}</ButtonLink>
        </Notice>
      ) : null}

      <Stats label={view.name} items={stats} />

      <div className={styles.buttons}>
        {view.hidden ? null : (
          <ButtonLink href={newOrderPath(view.id)} variant="primary">
            <AddIcon aria-hidden />
            {customersCopy.newOrder}
          </ButtonLink>
        )}
        {view.phone === undefined ? null : (
          <ButtonLink href={`tel:${view.phone.replaceAll(/[^\d+]/g, "")}`}>
            <CallIcon aria-hidden />
            {customersCopy.call}
          </ButtonLink>
        )}
      </div>

      {view.phone === undefined && view.address === undefined && view.note === undefined ? null : (
        <List>
          {view.phone === undefined ? null : (
            <ListRow
              title={view.phone}
              detail={customersCopy.fields.phone}
              icon={CallIcon}
              iconTone={iconTones.customer}
            />
          )}
          {view.address === undefined ? null : (
            <ListRow
              title={view.address}
              detail={customersCopy.fields.address}
              icon={LocationOnIcon}
              iconTone={iconTones.note}
            />
          )}
          {view.note === undefined ? null : (
            <ListRow
              title={view.note}
              detail={customersCopy.fields.note}
              icon={StickyNote2Icon}
              iconTone={iconTones.note}
            />
          )}
        </List>
      )}

      <OtherNames
        names={view.otherNames}
        footer={customersCopy.otherNamesFooter}
        maxLength={customerLimits.name}
        editable={!view.hidden}
        add={addName}
        remove={removeCustomerName}
      />

      <ReminderList
        heading={remindersCopy.title}
        reminders={reminders.reminders}
        today={reminders.today}
        showDue
        showCustomer={false}
        adding={adding}
        empty={remindersCopy.noneForCustomer}
      />

      {orders.length === 0 ? (
        <EmptyState title={customersCopy.noOrders} />
      ) : (
        <List heading={customersCopy.orders}>
          {orders.map((order) => (
            <ListLink
              key={order.id}
              href={orderPath(order.id)}
              title={`${shortDay(order.orderedOn)}, ${moneyText(order.total)}`}
              detail={orderDetail(order)}
              value={order.owed > 0 ? `${customersCopy.owes} ${moneyText(order.owed)}` : undefined}
              valueTone="danger"
              icon={ReceiptLongIcon}
              iconTone={order.owed > 0 ? iconTones.owed : iconTones.money}
            />
          ))}
        </List>
      )}

      {merging ? (
        <MergeDialog
          title={mergingCopy.pickCustomer}
          hint={pickCustomerHint(view.name)}
          label={mergingCopy.keptCustomer}
          emptyText={mergingCopy.noCustomer}
          fromId={view.id}
          suggest={suggestCustomers}
          describe={describeCustomer}
          confirm={confirmMerge}
          merge={merge}
          keptPath={customerPath}
          done={mergingCopy.mergedCustomer}
          onClose={closeMerge}
        />
      ) : null}
      {confirmDialog}
    </Screen>
  );
}
