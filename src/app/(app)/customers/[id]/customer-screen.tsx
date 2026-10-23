"use client";

import { startTransition, useCallback, useMemo } from "react";

import { ReminderList } from "@/app/(app)/_reminders/reminder-list";
import { hideCustomer, showCustomer } from "@/app/(app)/customers/actions";
import type { CustomerScreenView } from "@/features/customers/web/commands";
import { customerDetail } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { shortDay } from "@/features/orders/web/day-text";
import type { OrderRowView } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { newOrderPath } from "@/features/orders/web/orders-path";
import type { CustomerRemindersView } from "@/features/reminders/web/commands";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  AddIcon,
  CallIcon,
  EditIcon,
  LocationOnIcon,
  ReceiptLongIcon,
  StickyNote2Icon,
  VisibilityIcon,
  VisibilityOffIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { ListRow } from "@/shared/ui/list/list-row";
import { PageHeader } from "@/shared/ui/page-header/page-header";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { moneyText } from "@/shared/web/money-text";
import { editCustomerPath, orderPath, routes } from "@/shared/web/routes";

import styles from "./customer-screen.module.scss";

export type CustomerScreenProps = {
  readonly view: CustomerScreenView;
  // Newest first
  readonly orders: ReadonlyArray<OrderRowView & { readonly orderedOn: string }>;
  readonly reminders: CustomerRemindersView;
};

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

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: customersCopy.edit, icon: EditIcon, href: editCustomerPath(view.id) },
      view.hidden
        ? { label: customersCopy.show, icon: VisibilityIcon, onSelect: toggleHidden }
        : { label: customersCopy.hide, icon: VisibilityOffIcon, onSelect: toggleHidden },
    ],
    [toggleHidden, view.hidden, view.id],
  );
  const menu = useMemo(
    () => <ActionMenu label={actionLabels.options} actions={actions} />,
    [actions],
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
    <Screen>
      <PageHeader
        title={view.name}
        subtitle={customerDetail(view)}
        back={routes.customers}
        actions={menu}
      />

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
    </Screen>
  );
}
