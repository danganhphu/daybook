"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo, useState } from "react";

import {
  deleteOrder,
  deliverOrder,
  removePayment,
  restoreOrder,
  undeliverOrder,
} from "@/app/(app)/orders/actions";
import type { OrderChangeResult } from "@/features/orders/web/commands";
import { shortDay } from "@/features/orders/web/day-text";
import type { OrderScreenView, PaymentView } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { DayPicker } from "@/shared/ui/day-picker/day-picker";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  DeleteIcon,
  EditIcon,
  Inventory2Icon,
  LocalShippingIcon,
  PaymentsIcon,
  StickyNote2Icon,
  UndoIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListLink } from "@/shared/ui/list/list-link";
import { ListRow } from "@/shared/ui/list/list-row";
import { Notice } from "@/shared/ui/notice/notice";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { moneyText } from "@/shared/web/money-text";
import { customerPath, editOrderPath, productPath, routes } from "@/shared/web/routes";

import { PaymentDialog } from "./payment-dialog";

import styles from "./order-screen.module.scss";

const methodLabels: Record<string, string> = {
  cash: ordersCopy.cash,
  transfer: ordersCopy.transfer,
};

function paymentDetail(payment: PaymentView): string {
  return [
    `${ordersCopy.onDay} ${shortDay(payment.paidOn)}`,
    payment.method === undefined ? undefined : methodLabels[payment.method],
    payment.note,
    payment.removed ? ordersCopy.removed : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(", ");
}

// One order: its money at the top, then what was sold, the delivery, the payments and every change, newest first.
// Each change sends the version shown; the server answers and the page refreshes with the next one.
export function OrderScreen({ view }: { readonly view: OrderScreenView }) {
  const toast = useToast();
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  const run = useCallback(
    (change: () => Promise<OrderChangeResult>, done?: string) => {
      startTransition(async () => {
        const result = await attempt(change);
        if (!result.ok) {
          toast.show({ title: result.error });
        } else if (done !== undefined) {
          toast.show({ title: done });
        }
      });
    },
    [toast],
  );

  const restore = useCallback(
    () => run(() => restoreOrder(view.id, view.version)),
    [run, view.id, view.version],
  );

  // One tap, no confirmation: the toast's Undo is the safety net, as for a note
  const remove = useCallback(() => {
    startTransition(async () => {
      const result = await attempt(() => deleteOrder(view.id, view.version));
      if (!result.ok) {
        toast.show({ title: result.error });
        return;
      }
      const deletedVersion = result.value;
      toast.show({
        title: ordersCopy.deleted,
        action: {
          label: actionLabels.undo,
          onAction: () => run(() => restoreOrder(view.id, deletedVersion)),
        },
      });
      router.push(routes.orders);
    });
  }, [router, run, toast, view.id, view.version]);

  const menu = useMemo<ReadonlyArray<MenuAction>>(
    () =>
      view.deleted
        ? []
        : [{ label: ordersCopy.edit, icon: EditIcon, href: editOrderPath(view.id) }],
    [view.deleted, view.id],
  );
  const destructive = useMemo<MenuAction | undefined>(
    () =>
      view.deleted ? undefined : { label: ordersCopy.remove, icon: DeleteIcon, onSelect: remove },
    [remove, view.deleted],
  );

  const deliverOn = useCallback(
    (day: string) => run(() => deliverOrder(view.id, view.version, day)),
    [run, view.id, view.version],
  );
  const deliverToday = useCallback(() => deliverOn(view.today), [deliverOn, view.today]);
  const undeliver = useCallback(
    () => run(() => undeliverOrder(view.id, view.version)),
    [run, view.id, view.version],
  );
  const menuButton = useMemo(
    () =>
      view.deleted ? undefined : (
        <ActionMenu label={actionLabels.options} actions={menu} destructive={destructive} />
      ),
    [destructive, menu, view.deleted],
  );
  const stats = useMemo<ReadonlyArray<Stat>>(
    () => [
      { label: ordersCopy.total, value: moneyText(view.total) },
      { label: ordersCopy.collected, value: moneyText(view.paid) },
      {
        label: ordersCopy.owed,
        value: moneyText(view.owed),
        tone: view.owed > 0 ? "danger" : "neutral",
      },
    ],
    [view.owed, view.paid, view.total],
  );
  const dropPayment = useCallback(
    (paymentId: string) => run(() => removePayment(view.id, view.version, paymentId)),
    [run, view.id, view.version],
  );
  const openPayment = useCallback(() => setPaying(true), []);
  const closePayment = useCallback(() => setPaying(false), []);

  return (
    <Screen
      title={view.customerName}
      subtitle={`${ordersCopy.orderedOn} ${shortDay(view.orderedOn)}`}
      back={routes.orders}
      actions={menuButton}
    >
      {view.deleted ? (
        <Notice message={ordersCopy.isDeleted} tone="danger">
          <Button onClick={restore}>
            <UndoIcon aria-hidden />
            {ordersCopy.restore}
          </Button>
        </Notice>
      ) : null}

      <Stats label={ordersCopy.total} items={stats} />

      <List heading={ordersCopy.product}>
        {view.lines.map((line) => (
          <ListLink
            key={line.position}
            href={productPath(line.productId)}
            title={line.productName}
            detail={`${line.quantity} × ${moneyText(line.unitPrice)}`}
            value={moneyText(line.quantity * line.unitPrice)}
            icon={Inventory2Icon}
            iconTone={iconTones.item}
          />
        ))}
      </List>

      {view.note === undefined ? null : (
        <List heading={ordersCopy.note}>
          <ListRow title={view.note} icon={StickyNote2Icon} iconTone={iconTones.note} />
        </List>
      )}

      <List heading={ordersCopy.delivery}>
        {view.deliveredOn === undefined ? (
          <>
            <ListRow
              title={ordersCopy.notDelivered}
              icon={LocalShippingIcon}
              iconTone={iconTones.delivery}
            >
              {view.deleted ? null : (
                <DayPicker
                  label={ordersCopy.pickDeliveryDay}
                  day={view.today}
                  max={view.today}
                  onPick={deliverOn}
                />
              )}
            </ListRow>
            {view.deleted ? null : (
              <ListAction
                label={ordersCopy.deliveredToday}
                icon={LocalShippingIcon}
                onClick={deliverToday}
              />
            )}
          </>
        ) : (
          <ListRow
            title={ordersCopy.deliveredOn}
            detail={`${ordersCopy.onDay} ${shortDay(view.deliveredOn)}`}
            icon={LocalShippingIcon}
            iconTone={iconTones.delivery}
          >
            {view.deleted ? null : (
              <Button variant="quiet" onClick={undeliver}>
                {ordersCopy.unmarkDelivered}
              </Button>
            )}
          </ListRow>
        )}
      </List>

      <List heading={ordersCopy.payments}>
        {view.payments.length === 0 ? <ListRow title={ordersCopy.noPayments} /> : null}
        {view.payments.map((payment) => (
          <PaymentRow
            key={payment.id}
            payment={payment}
            removable={!payment.removed && !view.deleted}
            onRemove={dropPayment}
          />
        ))}
        {view.owed > 0 && !view.deleted ? (
          <ListAction label={ordersCopy.takePayment} icon={PaymentsIcon} onClick={openPayment} />
        ) : null}
      </List>

      <List heading={ordersCopy.history}>
        {view.history.map((entry) => (
          <li key={entry.id} className={styles.historyEntry}>
            <p>{entry.headline}</p>
            {entry.details.map((detail) => (
              <p key={detail} className={styles.historyDetail}>
                {detail}
              </p>
            ))}
            <p className={styles.historyWho}>
              {entry.by}, {entry.at}
            </p>
          </li>
        ))}
      </List>

      <ButtonLink href={customerPath(view.customerId)} variant="quiet">
        {ordersCopy.seeCustomer} {view.customerName}
      </ButtonLink>

      <PaymentDialog
        open={paying}
        onClose={closePayment}
        orderId={view.id}
        version={view.version}
        owed={view.owed}
        today={view.today}
      />
    </Screen>
  );
}

function PaymentRow({
  payment,
  removable,
  onRemove,
}: {
  readonly payment: PaymentView;
  readonly removable: boolean;
  readonly onRemove: (paymentId: string) => void;
}) {
  const destructive = useMemo<MenuAction>(
    () => ({
      label: ordersCopy.removePayment,
      icon: DeleteIcon,
      onSelect: () => onRemove(payment.id),
    }),
    [onRemove, payment.id],
  );

  return (
    <ListRow
      title={moneyText(payment.amount)}
      detail={paymentDetail(payment)}
      icon={PaymentsIcon}
      iconTone={iconTones.money}
    >
      {removable ? (
        <ActionMenu
          label={optionsFor(`${ordersCopy.paymentSubject} ${moneyText(payment.amount)}`)}
          destructive={destructive}
        />
      ) : null}
    </ListRow>
  );
}
