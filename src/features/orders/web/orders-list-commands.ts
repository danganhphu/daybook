import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { toKindView, type KindView } from "@/features/customers/web/customer-view";
import type { OrderFilter, OrderRow } from "@/features/orders/application/order-queries";
import { productIdSchema } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { recentlyDeletedSince } from "@/shared/domain/recently-deleted";
import { dayLabel } from "@/shared/web/day-label";
import { moneyText } from "@/shared/web/money-text";
import { recentlyDeleted, type DeletedRowView } from "@/shared/web/recently-deleted";
import { deletedText } from "@/shared/web/recently-deleted-since";

import { monthLabel, shortDay } from "./day-text";
import type { OrderRowView, OrderTotalsView } from "./order-view";
import { ordersCopy } from "./orders-copy";
import { orderStatusFilters, ordersPath, type OrderStatusFilter } from "./orders-path";

// Lists of orders - the month's, a customer's, a product's, the deleted ones - minus the framework: parse what the
// browser sent, call the app, answer with a view. Pages wrap these; tests call them directly.

// A screen of orders, enough for two people's month; more means the filter should be narrower
export const ordersListLimit = 200;

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((text) => Temporal.PlainYearMonth.from(text));

export type OrdersView = {
  // YYYY-MM
  readonly month: string;
  readonly title: string;
  readonly previousPath: string;
  // None past this month
  readonly nextPath: string | undefined;
  readonly status: OrderStatusFilter | "";
  readonly kindId: string;
  readonly kinds: ReadonlyArray<KindView>;
  readonly totals: OrderTotalsView;
  // Newest day first, each day's orders newest first
  readonly days: ReadonlyArray<{
    readonly day: string;
    readonly label: string;
    readonly rows: ReadonlyArray<OrderRowView>;
  }>;
  readonly more: boolean;
  readonly filtered: boolean;
};

function toRowView(row: OrderRow): DatedOrderRowView {
  return {
    id: row.id,
    orderedOn: row.orderedOn.toString(),
    customerName: row.customerName,
    customerArea: row.customerArea,
    products: row.productNames.join(", "),
    total: row.total,
    owed: Math.max(row.total - row.paid, 0),
    delivered: row.deliveredOn !== undefined,
  };
}

export async function ordersScreen(
  app: App,
  params: { readonly month?: unknown; readonly status?: unknown; readonly kind?: unknown },
): Promise<OrdersView> {
  const today = app.today();
  const thisMonth = today.toPlainYearMonth();
  const asked = monthSchema.safeParse(params.month);
  const month = asked.success ? asked.data : thisMonth;
  const status = z.enum(orderStatusFilters).safeParse(params.status);
  const kind = customerKindIdSchema.safeParse(params.kind);
  const filter = {
    from: month.toPlainDate({ day: 1 }),
    to: month.toPlainDate({ day: month.daysInMonth }),
    kindId: kind.success ? kind.data : undefined,
    delivery: status.data === "undelivered" ? ("undelivered" as const) : undefined,
    payment: status.data === "owed" ? ("owed" as const) : undefined,
  };
  const query = {
    status: status.success ? status.data : undefined,
    kind: kind.success ? kind.data : undefined,
  };

  const [rows, totals, kinds] = await Promise.all([
    app.listOrders(filter, ordersListLimit + 1),
    app.orderTotals(filter),
    app.listCustomerKinds(),
  ]);
  const shown = rows.slice(0, ordersListLimit);
  const byDay = Map.groupBy(shown, (row) => row.orderedOn.toString());
  const next = month.add({ months: 1 });

  return {
    month: month.toString(),
    title: monthLabel(month.toString()),
    previousPath: ordersPath({ ...query, month: month.subtract({ months: 1 }).toString() }),
    nextPath:
      Temporal.PlainYearMonth.compare(next, thisMonth) > 0
        ? undefined
        : ordersPath({ ...query, month: next.equals(thisMonth) ? undefined : next.toString() }),
    status: status.success ? status.data : "",
    kindId: kind.success ? kind.data : "",
    kinds: kinds.filter((each) => each.status === "active").map(toKindView),
    totals,
    days: [...byDay].map(([day, dayRows]) => ({
      day,
      label: dayLabel(Temporal.PlainDate.from(day), today),
      rows: dayRows.map(toRowView),
    })),
    more: rows.length > ordersListLimit,
    filtered: status.success || kind.success,
  };
}

// Earlier than any order in the book, for a list that is not about a period
const beforeAnyOrder = Temporal.PlainDate.from("2000-01-01");

export type DatedOrderRowView = OrderRowView & { readonly orderedOn: string };

// The newest orders of one customer, for their page
export function customerOrders(
  app: App,
  customerId: string,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  return newestOrders(app, { customerId: customerIdSchema.parse(customerId) });
}

// The newest orders that sold one product, for its page
export function productOrders(
  app: App,
  productId: string,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  return newestOrders(app, { productId: productIdSchema.parse(productId) });
}

async function newestOrders(
  app: App,
  narrowed: Pick<OrderFilter, "customerId" | "productId">,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  const rows = await app.listOrders(
    { from: beforeAnyOrder, to: app.today(), ...narrowed },
    ordersListLimit,
  );

  return rows.map(toRowView);
}

// Orders deleted lately, for "Đã xoá gần đây"; `people` names who deleted each
export async function deletedOrders(
  app: App,
  people: ReadonlyMap<AccountId, string>,
): Promise<ReadonlyArray<DeletedRowView>> {
  const rows = await app.listDeletedOrders(recentlyDeletedSince(app.now()), recentlyDeleted.limit);

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.customerName,
    detail: [
      `${ordersCopy.order} ${shortDay(row.orderedOn.toString())}`,
      moneyText(row.total),
      deletedText(row.deletedAt, people.get(row.deletedBy) ?? "?"),
    ].join(", "),
    deletedAt: row.deletedAt.epochMilliseconds,
  }));
}
