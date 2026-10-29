import { TabActions } from "@/app/(app)/_shell/tab-actions";
import type { OrdersView } from "@/features/orders/web/commands";
import type { OrderRowView } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { ordersPath } from "@/features/orders/web/orders-path";
import { productsCopy } from "@/features/products/web/products-copy";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { IconButton } from "@/shared/ui/button/icon-button";
import { IconLink } from "@/shared/ui/button/icon-link";
import { ChipLinks, type ChipLink } from "@/shared/ui/chip-links/chip-links";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { FabLink } from "@/shared/ui/fab/fab-link";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  AddIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Inventory2Icon,
  ReceiptLongIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { moneyText } from "@/shared/web/money-text";
import { orderPath, routes } from "@/shared/web/routes";

import styles from "./orders.module.scss";

function rowDetail(row: OrderRowView): string {
  return [
    row.products,
    row.delivered ? undefined : ordersCopy.undelivered,
    row.owed > 0 ? `${ordersCopy.owed} ${moneyText(row.owed)}` : undefined,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
}

// The products the orders are made of, named in words rather than a bare icon, then the bell and the account
function HeaderActions({ unread }: { readonly unread: number }) {
  return (
    <>
      <ButtonLink href={routes.products} variant="quiet">
        <Inventory2Icon aria-hidden />
        {productsCopy.title}
      </ButtonLink>
      <TabActions unread={unread} />
    </>
  );
}

function heroStat(view: OrdersView): Stat {
  return { label: ordersCopy.revenue, value: moneyText(view.totals.total) };
}

function stats(view: OrdersView): ReadonlyArray<Stat> {
  return [
    { label: ordersCopy.collected, value: moneyText(view.totals.paid) },
    {
      label: ordersCopy.owed,
      value: moneyText(view.totals.owed),
      tone: view.totals.owed > 0 ? "danger" : "neutral",
    },
    { label: ordersCopy.orderCount, value: String(view.totals.count) },
  ];
}

// The month and the kind carry over from one status to another
function statusChips(view: OrdersView): ReadonlyArray<ChipLink> {
  const query = { month: view.month, kind: view.kindId };

  return [
    { label: ordersCopy.all, href: ordersPath(query), current: view.status === "" },
    {
      label: ordersCopy.undelivered,
      href: ordersPath({ ...query, status: "undelivered" }),
      current: view.status === "undelivered",
    },
    {
      label: ordersCopy.owed,
      href: ordersPath({ ...query, status: "owed" }),
      current: view.status === "owed",
    },
  ];
}

function kindChips(view: OrdersView): ReadonlyArray<ChipLink> {
  return [
    {
      label: ordersCopy.allKinds,
      href: ordersPath({ month: view.month, status: view.status }),
      current: view.kindId === "",
    },
    ...view.kinds.map((kind) => ({
      label: kind.name,
      href: ordersPath({ month: view.month, status: view.status, kind: kind.id }),
      current: kind.id === view.kindId,
    })),
  ];
}

// A month of orders: its numbers at the top, the orders below by day, newest first. The month, the status chips and
// the kind chips are links, so the filters live in the URL.
export function OrdersScreen({
  view,
  unread,
}: {
  readonly view: OrdersView;
  readonly unread: number;
}) {
  // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- a server component renders once a request: nothing to memoize for
  const actions = <HeaderActions unread={unread} />;

  return (
    <Screen title={ordersCopy.title} actions={actions}>
      <nav className={styles.months} aria-label={view.title}>
        <IconLink
          icon={ChevronLeftIcon}
          label={ordersCopy.previousMonth}
          href={view.previousPath}
        />
        <h2 className={styles.month}>{view.title}</h2>
        {view.nextPath === undefined ? (
          <IconButton icon={ChevronRightIcon} label={ordersCopy.noNextMonth} disabled />
        ) : (
          <IconLink icon={ChevronRightIcon} label={ordersCopy.nextMonth} href={view.nextPath} />
        )}
      </nav>

      <Stats label={view.title} hero={heroStat(view)} items={stats(view)} />

      <div className={styles.filters}>
        <ChipLinks label={ordersCopy.title} chips={statusChips(view)} />
        {view.kinds.length === 0 ? null : (
          <ChipLinks label={ordersCopy.allKinds} chips={kindChips(view)} />
        )}
      </div>

      {view.days.length === 0 ? (
        <EmptyState title={view.filtered ? ordersCopy.emptyFiltered : ordersCopy.empty} />
      ) : (
        view.days.map((day) => (
          <List key={day.day} heading={day.label}>
            {day.rows.map((row) => (
              <ListLink
                key={row.id}
                href={orderPath(row.id)}
                title={row.customerName}
                detail={rowDetail(row)}
                value={moneyText(row.total)}
                icon={ReceiptLongIcon}
                iconTone={row.owed > 0 ? iconTones.owed : iconTones.money}
              />
            ))}
          </List>
        ))
      )}

      {view.more ? <p className={styles.more}>{ordersCopy.more}</p> : null}
      <FabLink icon={AddIcon} label={ordersCopy.add} href={routes.newOrder} />
    </Screen>
  );
}
